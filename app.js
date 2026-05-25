// state Management
const state = {
    isConnected: false,
    isConnecting: false,
    isSimulator: false,
    rawWeightGrams: 0.0,
    tareOffsetGrams: 0.0,
    shouldTareOnNextReading: false, // Flag for initial tare on connect
    units: 'g', // 'g' or 'oz'
    history: [],

    // BLE device references
    device: null,
    weightChar: null,

    // --- Coffee Pourover Feature State ---
    activeTab: 'general', // 'general' or 'pourover'
    coffee: {
        doseGrams: 15.0,
        ratio: 16.0,
        targetWaterGrams: 240.0,
        bloomWaterGrams: 45.0,
        waterTareOffset: 0.0,
        vesselTareOffset: 0.0,
    },
    timer: {
        running: false,
        seconds: 0,
        intervalId: null,
        autoStartArmed: true,
        startedAt: null
    },
    flow: {
        history: [], // [{time: ms, weight: grams}]
        rate: 0.0 // g/s
    },
    brew: {
        phase: 'prep', // 'prep', 'bloom', 'brew', 'drawdown', 'finished'
        bloomTimerId: null,
        bloomSecondsLeft: 35,
        totalBrewTime: 0,
        totalYield: 0,
        avgFlowRate: 0.0,
        flowRatesRecorded: [] // list of active flow rates to calculate average
    }
};

// BLE UUID Constants (Smart Kitchen Scale Bluetooth Protocol)
const SCALE_SERVICE_UUID = 'b5600001-a0f8-16af-bb42-1d3b642ec2e1';
const SCALE_RAW_ADC_CHAR_UUID = 'b5600007-a0f8-16af-bb42-1d3b642ec2e1'; // Zero-delay raw ADC
const SCALE_WEIGHT_CHAR_UUID = 'b5600003-a0f8-16af-bb42-1d3b642ec2e1';   // Microcontroller-smoothed weight

// Max capacity for display gauge (grams)
const MAX_SCALE_CAPACITY_GRAMS = 7000;

// DOM Elements
const elements = {
    // Shared / Scale UI
    btnConnect: document.getElementById('btn-connect'),
    btnTare: document.getElementById('btn-tare'),
    btnZero: document.getElementById('btn-zero'),
    btnToggleUnits: document.getElementById('btn-toggle-units'),
    btnLog: document.getElementById('btn-log'),
    btnClearHistory: document.getElementById('btn-clear-history'),

    statusText: document.getElementById('status-text'),
    statusContainer: document.getElementById('status-container'),
    weightNumber: document.getElementById('weight-number'),
    weightUnit: document.getElementById('weight-unit'),
    rawSubtext: document.getElementById('raw-subtext'),
    gaugeFill: document.getElementById('gauge-fill'),

    simSwitch: document.getElementById('sim-switch'),
    simPanel: document.getElementById('sim-panel'),
    simWeightSlider: document.getElementById('sim-weight'),
    simWeightVal: document.getElementById('sim-weight-val'),

    historyList: document.getElementById('history-list'),

    // --- Tab Navigation Elements ---
    btnTabGeneral: document.getElementById('btn-tab-general'),
    btnTabPourover: document.getElementById('btn-tab-pourover'),
    viewGeneral: document.getElementById('view-general'),
    viewPourover: document.getElementById('view-pourover'),

    // --- Pourover Telemetry Elements ---
    pouroverStatusBadge: document.getElementById('pourover-status-badge'),
    pouroverGaugeFill: document.getElementById('pourover-gauge-fill'),
    coffeeTimer: document.getElementById('coffee-timer'),
    coffeeWeightNumber: document.getElementById('coffee-weight-number'),
    coffeeWeightUnit: document.getElementById('coffee-weight-unit'),
    coffeeFlowRate: document.getElementById('coffee-flow-rate'),
    coffeeRawSubtext: document.getElementById('coffee-raw-subtext'),

    // --- Pourover Buttons ---
    btnCoffeeConnect: document.getElementById('btn-coffee-connect'),
    btnCoffeeTimerToggle: document.getElementById('btn-coffee-timer-toggle'),
    btnCoffeeTimerReset: document.getElementById('btn-coffee-timer-reset'),
    btnCoffeeTareWater: document.getElementById('btn-coffee-tare-water'),
    btnCoffeeTareVessel: document.getElementById('btn-coffee-tare-vessel'),
    chkAutoStart: document.getElementById('chk-auto-start'),

    // --- Recipe Elements ---
    lblCoffeeDose: document.getElementById('lbl-coffee-dose'),
    sliderCoffeeDose: document.getElementById('slider-coffee-dose'),
    numCoffeeDose: document.getElementById('num-coffee-dose'),
    lblBrewRatio: document.getElementById('lbl-brew-ratio'),
    sliderBrewRatio: document.getElementById('slider-brew-ratio'),
    customRatioContainer: document.getElementById('custom-ratio-container'),
    calcTargetWater: document.getElementById('calc-target-water'),
    calcBloomWater: document.getElementById('calc-bloom-water'),

    // --- Phase Elements ---
    brewPhaseBadge: document.getElementById('brew-phase-badge'),
    stepPrep: document.getElementById('step-prep'),
    stepBloom: document.getElementById('step-bloom'),
    stepBloomTarget: document.getElementById('step-bloom-target'),
    bloomTimerDisplay: document.getElementById('bloom-timer-display'),
    stepBrew: document.getElementById('step-brew'),
    stepBrewTarget: document.getElementById('step-brew-target'),
    stepDrawdown: document.getElementById('step-drawdown'),

    // --- Summary Panel Elements ---
    brewSummaryPanel: document.getElementById('brew-summary-panel'),
    summaryTotalTime: document.getElementById('summary-total-time'),
    summaryTotalYield: document.getElementById('summary-total-yield'),
    summaryAvgFlow: document.getElementById('summary-avg-flow')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    handleURLRouting(); // Evaluate URL route on launch
    window.addEventListener('hashchange', handleURLRouting);
    updateUI();
});

function setupEventListeners() {
    // Shared / Scale UI Events
    elements.btnConnect.addEventListener('click', handleConnectToggle);
    elements.btnTare.addEventListener('click', tareScale);
    elements.btnZero.addEventListener('click', zeroScale);
    elements.btnToggleUnits.addEventListener('click', toggleUnits);
    elements.btnLog.addEventListener('click', addCurrentToHistory);
    elements.btnClearHistory.addEventListener('click', clearHistory);

    elements.simSwitch.addEventListener('change', handleSimulatorToggle);
    elements.simWeightSlider.addEventListener('input', handleSimWeightChange);

    // Tab Navigation Events
    elements.btnTabGeneral.addEventListener('click', () => switchTab('general'));
    elements.btnTabPourover.addEventListener('click', () => switchTab('pourover'));

    // Coffee Dose Events
    elements.sliderCoffeeDose.addEventListener('input', handleCoffeeDoseSliderChange);
    elements.numCoffeeDose.addEventListener('change', handleCoffeeDoseNumChange);

    // Ratio selector presets
    document.querySelectorAll('.ratio-presets .ratio-pill').forEach(pill => {
        pill.addEventListener('click', handleRatioPillClick);
    });
    elements.sliderBrewRatio.addEventListener('input', handleBrewRatioSliderChange);

    // Coffee Pourover Telemetry Actions
    elements.btnCoffeeConnect.addEventListener('click', handleConnectToggle);
    elements.btnCoffeeTimerToggle.addEventListener('click', toggleCoffeeTimer);
    elements.btnCoffeeTimerReset.addEventListener('click', resetCoffeeTimer);
    elements.btnCoffeeTareWater.addEventListener('click', tareWater);
    elements.btnCoffeeTareVessel.addEventListener('click', tareVessel);
    elements.chkAutoStart.addEventListener('change', handleAutoStartChange);
}

// --- Main Scale Operations & Calculations ---

// Get current display weight (accounting for software tare offset)
function getDisplayWeightGrams() {
    return state.rawWeightGrams - state.tareOffsetGrams;
}

// Convert grams to active display unit (supports unitOverride for history logs)
function formatWeight(grams, unitOverride) {
    const activeUnit = unitOverride || state.units;
    if (activeUnit === 'oz') {
        const ounces = grams * 0.03527396;
        return ounces.toFixed(2);
    } else if (activeUnit === 'lb:oz') {
        const totalOunces = grams * 0.03527396;
        const absOunces = Math.abs(totalOunces);
        const lbs = Math.floor(absOunces / 16);
        const oz = absOunces % 16;
        const sign = totalOunces < 0 ? '-' : '';
        return `${sign}${lbs}:${oz.toFixed(1).padStart(4, '0')}`;
    }
    return grams.toFixed(1);
}

let updateScheduled = false;

// Update weight rendering, SVG progress dial, and raw telemetry text (Throttled via requestAnimationFrame)
function updateUI() {
    if (updateScheduled) return;
    updateScheduled = true;

    requestAnimationFrame(() => {
        updateScheduled = false;

        const rawValStr = formatWeight(state.rawWeightGrams);
        const isActive = state.isConnected || state.isSimulator;

        // --- 1. General Tab UI Update ---
        const displayWeight = getDisplayWeightGrams();
        const formattedVal = formatWeight(displayWeight);

        elements.weightNumber.textContent = formattedVal;

        // Adjust typography size dynamically for lb:oz to ensure standard sizing and fit
        if (state.units === 'lb:oz') {
            elements.weightNumber.style.fontSize = '3.2rem';
            elements.weightUnit.textContent = 'lb oz';
            elements.weightUnit.style.color = displayWeight < -5 ? 'var(--accent-rose)' : 'var(--accent-cyan)';
        } else {
            elements.weightNumber.style.fontSize = '4rem';
            elements.weightUnit.textContent = state.units;
        }

        // Update gauge radial path
        // Stroke dasharray is 754 (2 * PI * 120 radius)
        const strokeDash = 754;
        const progressFraction = Math.max(0, Math.min(1, Math.abs(displayWeight) / MAX_SCALE_CAPACITY_GRAMS));
        const offset = strokeDash - (progressFraction * strokeDash);
        elements.gaugeFill.style.strokeDashoffset = offset;

        // Change dial color if weight is negative or near capacity
        if (displayWeight < -5) {
            elements.gaugeFill.style.stroke = 'var(--accent-rose)';
            elements.weightUnit.style.color = 'var(--accent-rose)';
        } else if (displayWeight > MAX_SCALE_CAPACITY_GRAMS * 0.95) {
            elements.gaugeFill.style.stroke = 'var(--accent-amber)';
            elements.weightUnit.style.color = 'var(--accent-amber)';
        } else {
            elements.gaugeFill.style.stroke = 'var(--accent-cyan)';
            if (state.units !== 'lb:oz') {
                elements.weightUnit.style.color = 'var(--accent-cyan)';
            }
        }

        // Update raw telemetry footer
        const tareValStr = formatWeight(state.tareOffsetGrams);
        const unitLabel = state.units === 'lb:oz' ? ' lb oz' : state.units;
        elements.rawSubtext.textContent = `Raw: ${rawValStr}${unitLabel} | Offset: ${tareValStr}${unitLabel}`;

        // Enable/disable buttons depending on state
        elements.btnTare.disabled = !isActive;
        elements.btnZero.disabled = !isActive || state.tareOffsetGrams === 0;
        elements.btnLog.disabled = !isActive;

        // --- 2. Pourover Tab UI Update ---
        if (state.activeTab === 'pourover') {
            const currentWaterWeight = Math.max(0, state.rawWeightGrams - state.coffee.waterTareOffset);
            elements.coffeeWeightNumber.textContent = currentWaterWeight.toFixed(1);

            // Circular progress fill for pourover towards target water weight
            const pFraction = Math.max(0, Math.min(1, currentWaterWeight / (state.coffee.targetWaterGrams || 240.0)));
            const pOffset = strokeDash - (pFraction * strokeDash);
            elements.pouroverGaugeFill.style.strokeDashoffset = pOffset;

            // Dynamic ring styling
            if (currentWaterWeight >= state.coffee.targetWaterGrams * 0.98 && currentWaterWeight <= state.coffee.targetWaterGrams * 1.02) {
                elements.pouroverGaugeFill.style.stroke = 'var(--accent-emerald)'; // Target reached
                elements.pouroverGaugeFill.style.filter = 'drop-shadow(0 0 12px var(--accent-emerald-glow))';
            } else if (currentWaterWeight > state.coffee.targetWaterGrams * 1.02) {
                elements.pouroverGaugeFill.style.stroke = 'var(--accent-rose)'; // Overfilled
                elements.pouroverGaugeFill.style.filter = 'drop-shadow(0 0 12px var(--accent-rose-glow))';
            } else if (state.brew.phase === 'bloom') {
                elements.pouroverGaugeFill.style.stroke = 'var(--accent-amber)'; // Blooming
                elements.pouroverGaugeFill.style.filter = 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.35))';
            } else {
                elements.pouroverGaugeFill.style.stroke = 'var(--accent-cyan)';
                elements.pouroverGaugeFill.style.filter = 'drop-shadow(0 0 8px var(--accent-cyan-glow))';
            }

            // Raw text footer
            const offsetValStr = state.coffee.waterTareOffset.toFixed(1);
            elements.coffeeRawSubtext.textContent = `Raw: ${state.rawWeightGrams.toFixed(1)}g | Water Offset: ${offsetValStr}g`;

            // Badges and status
            if (state.isSimulator) {
                elements.pouroverStatusBadge.textContent = 'Simulator';
                elements.pouroverStatusBadge.className = 'badge badge-connected';
            } else if (state.isConnected) {
                elements.pouroverStatusBadge.textContent = 'Connected';
                elements.pouroverStatusBadge.className = 'badge badge-connected';
            } else {
                elements.pouroverStatusBadge.textContent = 'Disconnected';
                elements.pouroverStatusBadge.className = 'badge badge-disconnected';
            }
        }
    });
}

// Set software tare to current weight
function tareScale() {
    state.tareOffsetGrams = state.rawWeightGrams;
    updateUI();
}

// Reset software tare offset to zero
function zeroScale() {
    state.tareOffsetGrams = 0.0;
    updateUI();
}

// Toggle display units: Grams vs Ounces vs Pounds & Ounces
function toggleUnits() {
    if (state.units === 'g') {
        state.units = 'oz';
    } else if (state.units === 'oz') {
        state.units = 'lb:oz';
    } else {
        state.units = 'g';
    }
    updateUI();
}

// --- Web Bluetooth GATT Operations ---

async function handleConnectToggle() {
    if (state.isConnected || state.isConnecting) {
        disconnectScale();
        return;
    }

    // Turn off simulator if active before attempting hardware connection
    if (state.isSimulator) {
        elements.simSwitch.checked = false;
        handleSimulatorToggle();
    }

    state.isConnecting = true;
    updateStatus('Connecting...', 'connecting');
    updateConnectButtons('connecting');

    try {
        console.log('Requesting Bluetooth Device...');
        state.device = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'Perfect' }, { namePrefix: 'perfect' },
                { namePrefix: 'Pure' }, { namePrefix: 'pure' },
                { namePrefix: 'Scale' }, { namePrefix: 'scale' },
                { namePrefix: 'Bake' }, { namePrefix: 'bake' },
                { namePrefix: 'Drink' }, { namePrefix: 'drink' },
                { namePrefix: 'Blend' }, { namePrefix: 'blend' },
                { namePrefix: 'Smart' }, { namePrefix: 'smart' },
                { namePrefix: 'Kitchen' }, { namePrefix: 'kitchen' },
                { namePrefix: 'Vitamix' }, { namePrefix: 'vitamix' }
            ],
            optionalServices: [SCALE_SERVICE_UUID, 'battery_service', 'device_information']
        });

        state.device.addEventListener('gattserverdisconnected', onDeviceDisconnected);

        console.log('Connecting to GATT Server...');
        const server = await state.device.gatt.connect();

        console.log('Discovering Primary Scale Service...');
        const service = await server.getPrimaryService(SCALE_SERVICE_UUID);

        console.log('Discovering Weight Characteristics...');

        // Weight notification characteristic (b5600003)
        try {
            state.weightChar = await service.getCharacteristic(SCALE_WEIGHT_CHAR_UUID);
            await state.weightChar.startNotifications();
            state.weightChar.addEventListener('characteristicvaluechanged', handleWeightNotification);
            console.log('Subscribed to Weight Notifications successfully.');
        } catch (e) {
            console.error('Weight characteristic connection failed:', e);
            throw e;
        }

        // Complete connection setup
        state.isConnected = true;
        state.isConnecting = false;
        updateStatus('Connected to Scale', 'connected');
        updateConnectButtons('connected');

        // Reset scale reading and arm the initial tare flag
        state.rawWeightGrams = 0.0;
        state.tareOffsetGrams = 0.0;
        state.shouldTareOnNextReading = true; // Automatically tare on first reading
        updateUI();

    } catch (error) {
        console.error('Bluetooth connection error:', error);
        disconnectScale();
    }
}

// Disconnect BLE scale
function disconnectScale() {
    if (state.device && state.device.gatt.connected) {
        state.device.gatt.disconnect();
    }
    onDeviceDisconnected();
}

// GATT Server Disconnected Callback
function onDeviceDisconnected() {
    console.log('Bluetooth Scale Disconnected.');

    // Clean up notifications
    if (state.weightChar) {
        state.weightChar.removeEventListener('characteristicvaluechanged', handleWeightNotification);
    }

    // Reset state
    state.isConnected = false;
    state.isConnecting = false;
    state.weightChar = null;
    state.device = null;
    state.shouldTareOnNextReading = false;

    updateStatus('Disconnected', 'disconnected');
    updateConnectButtons('disconnected');

    updateUI();
}

// --- Binary Parsing Math for GATT Notifications ---

// Throttle logging to avoid blocking Chrome's main thread
let lastLogTime = 0;

// Extract Weight Bytes and convert to Grams
function handleWeightNotification(event) {
    const dataView = event.target.value;

    // Support both 3-byte (raw BLE) and 4-byte (wrapped JNI) payloads
    if (dataView.byteLength < 3) {
        console.warn(`Packet ignored because length ${dataView.byteLength} is less than 3 bytes.`);
        return;
    }

    let b1, b2, b3;
    if (dataView.byteLength === 3) {
        b1 = dataView.getUint8(0); // LSB
        b2 = dataView.getUint8(1); // Mid
        b3 = dataView.getUint8(2); // MSB
    } else {
        b1 = dataView.getUint8(1); // LSB
        b2 = dataView.getUint8(2); // Mid
        b3 = dataView.getUint8(3); // MSB
    }

    // Combine into 24-bit integer
    let rawVal = b1 | (b2 << 8) | (b3 << 16);

    // Sign extension from 24-bit to 32-bit signed integer
    if (rawVal & 0x800000) {
        rawVal -= 0x1000000;
    }

    // Extract calibrated weight in grams using the hardware scale factor (623.05 counts/gram)
    const grams = rawVal / 623.05;

    // Throttle telemetry logging to once every 1000ms to prevent browser thread congestion
    const now = Date.now();
    if (now - lastLogTime > 1000) {
        console.log(`Telemetry update: rawVal=${rawVal}, grams=${grams.toFixed(2)}g`);
        lastLogTime = now;
    }

    updateWeightState(grams);

    // Automatically tare the very first reading on connect
    if (state.shouldTareOnNextReading) {
        state.tareOffsetGrams = grams;
        state.coffee.vesselTareOffset = grams;
        state.coffee.waterTareOffset = grams;
        state.shouldTareOnNextReading = false;
        console.log(`Initial tare on connect applied: ${grams.toFixed(2)}g`);
        updateUI();
    }
}

// --- Simulator Engine ---

function handleSimulatorToggle() {
    state.isSimulator = elements.simSwitch.checked;

    if (state.isSimulator) {
        // Turn off BLE connection if connected
        if (state.isConnected) {
            disconnectScale();
        }

        elements.simPanel.classList.add('visible');
        updateStatus('Simulator Mode', 'connected'); // Highlight green for simulator active

        // Seed default weight and apply initial tare immediately
        const initWeight = parseFloat(elements.simWeightSlider.value);
        state.rawWeightGrams = initWeight;
        state.tareOffsetGrams = initWeight; // Initial tare on simulator connect
        state.coffee.vesselTareOffset = initWeight;
        state.coffee.waterTareOffset = initWeight;
        state.shouldTareOnNextReading = false;

        // Reset flow rates
        state.flow.history = [];
        state.flow.rate = 0.0;

        updateUI();
    } else {
        elements.simPanel.classList.remove('visible');
        updateStatus('Disconnected', 'disconnected');

        // Reset scale reading
        state.rawWeightGrams = 0.0;
        state.tareOffsetGrams = 0.0;
        state.coffee.vesselTareOffset = 0.0;
        state.coffee.waterTareOffset = 0.0;
        updateUI();
    }
}

function handleSimWeightChange() {
    if (!state.isSimulator) return;

    const sliderVal = parseFloat(elements.simWeightSlider.value);
    elements.simWeightVal.textContent = `${sliderVal.toFixed(1)}g`;

    updateWeightState(sliderVal);
}

// --- Helper Functions ---

// Update central connection banner class & text
function updateStatus(text, className) {
    elements.statusText.textContent = text;
    elements.statusContainer.className = `connection-bar status-${className}`;
}

// --- History Snapshot Logging ---

function addCurrentToHistory() {
    const displayWeight = getDisplayWeightGrams();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const logItem = {
        id: Date.now(),
        weight: displayWeight,
        time: timestamp,
        units: state.units
    };

    state.history.unshift(logItem); // Insert at start
    renderHistory();
}

function clearHistory() {
    state.history = [];
    renderHistory();
}

function renderHistory() {
    if (state.history.length === 0) {
        elements.historyList.innerHTML = `<div class="history-empty">No logged readings yet</div>`;
        return;
    }

    const itemsHTML = state.history.map(item => {
        const formatted = formatWeight(item.weight, item.units);
        const unitLabel = item.units === 'lb:oz' ? ' lb oz' : item.units;
        return `
            <div class="history-item">
                <div class="history-info">
                    <span class="history-label">Weight Snapshot</span>
                    <span class="history-time">${item.time}</span>
                </div>
                <span class="history-weight">${formatted}${unitLabel}</span>
            </div>
        `;
    }).join('');

    elements.historyList.innerHTML = itemsHTML;
}

// ==========================================
// --- Coffee Pourover Feature Functions ---
// ==========================================

// Centralized weight update router
function updateWeightState(grams) {
    state.rawWeightGrams = grams;
    handlePouroverTelemetry(grams);
    updateUI();
}

// Switch between General Scale and Coffee Pourover dashboard tabs
function switchTab(tabName) {
    if (state.activeTab === tabName) return;

    state.activeTab = tabName;

    if (tabName === 'general') {
        elements.btnTabGeneral.classList.add('active');
        elements.btnTabPourover.classList.remove('active');

        // Toggle display directly in JS to bypass inline HTML stylesheet overrides
        elements.viewGeneral.style.display = 'grid';
        elements.viewPourover.style.display = 'none';

        elements.viewGeneral.classList.add('active-tab');
        elements.viewPourover.classList.remove('active-tab');
        if (window.location.hash !== '#general') {
            window.location.hash = 'general';
        }
    } else {
        elements.btnTabGeneral.classList.remove('active');
        elements.btnTabPourover.classList.add('active');

        // Toggle display directly in JS to bypass inline HTML stylesheet overrides
        elements.viewGeneral.style.display = 'none';
        elements.viewPourover.style.display = 'grid';

        elements.viewGeneral.classList.remove('active-tab');
        elements.viewPourover.classList.add('active-tab');
        if (window.location.hash !== '#coffee') {
            window.location.hash = 'coffee';
        }

        // Initial recipe synchronization
        updateRecipeCalculations();
    }

    updateUI();
}

// Robust router supporting Hash Routing (#coffee), Query string (?view=coffee), and URL path (/coffee)
function handleURLRouting() {
    const hash = window.location.hash;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (hash === '#coffee' || path.endsWith('/coffee') || params.get('view') === 'coffee' || params.get('tab') === 'coffee') {
        switchTab('pourover');
    } else {
        switchTab('general');
    }
}

// Unify connection states across both General and Pourover tabs
function updateConnectButtons(status) {
    if (status === 'disconnected') {
        elements.btnConnect.textContent = 'Connect Scale';
        elements.btnConnect.className = 'btn btn-primary';

        elements.btnCoffeeConnect.innerHTML = '<i class="fa-brands fa-bluetooth"></i> Connect Scale';
        elements.btnCoffeeConnect.className = 'btn btn-primary';
    } else if (status === 'connecting') {
        elements.btnConnect.textContent = 'Cancel';
        elements.btnConnect.className = 'btn btn-secondary';

        elements.btnCoffeeConnect.textContent = 'Cancel';
        elements.btnCoffeeConnect.className = 'btn btn-secondary';
    } else if (status === 'connected') {
        elements.btnConnect.textContent = 'Disconnect';
        elements.btnConnect.className = 'btn btn-danger';

        elements.btnCoffeeConnect.innerHTML = '<i class="fa-solid fa-power-off"></i> Disconnect';
        elements.btnCoffeeConnect.className = 'btn btn-danger';
    }
}

// --- Recipe Builder Listeners ---

function handleCoffeeDoseSliderChange() {
    const val = parseFloat(elements.sliderCoffeeDose.value);
    elements.numCoffeeDose.value = val.toFixed(1);
    state.coffee.doseGrams = val;
    updateRecipeCalculations();
}

function handleCoffeeDoseNumChange() {
    let val = parseFloat(elements.numCoffeeDose.value);
    if (isNaN(val)) val = 15.0;
    val = Math.max(10, Math.min(50, val));
    elements.numCoffeeDose.value = val.toFixed(1);
    elements.sliderCoffeeDose.value = val;
    state.coffee.doseGrams = val;
    updateRecipeCalculations();
}

function handleRatioPillClick(e) {
    const pill = e.currentTarget;

    // Deactivate others
    document.querySelectorAll('.ratio-presets .ratio-pill').forEach(btn => btn.classList.remove('active'));
    pill.classList.add('active');

    if (pill.id === 'btn-ratio-custom') {
        elements.customRatioContainer.style.display = 'block';
        const customRatio = parseFloat(elements.sliderBrewRatio.value);
        state.coffee.ratio = customRatio;
    } else {
        elements.customRatioContainer.style.display = 'none';
        const ratio = parseFloat(pill.dataset.ratio);
        state.coffee.ratio = ratio;
    }

    updateRecipeCalculations();
}

function handleBrewRatioSliderChange() {
    const ratio = parseFloat(elements.sliderBrewRatio.value);
    elements.lblBrewRatio.textContent = ratio.toFixed(1);
    state.coffee.ratio = ratio;
    updateRecipeCalculations();
}

function updateRecipeCalculations() {
    state.coffee.targetWaterGrams = state.coffee.doseGrams * state.coffee.ratio;
    state.coffee.bloomWaterGrams = state.coffee.doseGrams * 3.0; // Standard 3x dry weight bloom

    // Update label nodes
    elements.lblCoffeeDose.textContent = state.coffee.doseGrams.toFixed(1);
    elements.lblBrewRatio.textContent = state.coffee.ratio.toFixed(1);
    elements.calcTargetWater.textContent = `${state.coffee.targetWaterGrams.toFixed(1)}g`;
    elements.calcBloomWater.textContent = `${state.coffee.bloomWaterGrams.toFixed(1)}g`;

    elements.stepBloomTarget.textContent = `${state.coffee.bloomWaterGrams.toFixed(1)}g`;
    elements.stepBrewTarget.textContent = `${state.coffee.targetWaterGrams.toFixed(1)}g`;
}

// --- Coffee Scale Tares ---

function tareVessel() {
    state.coffee.vesselTareOffset = state.rawWeightGrams;
    state.coffee.waterTareOffset = state.rawWeightGrams; // Start water measurement here

    resetBrewProgress();
    updateUI();
}

function tareWater() {
    state.coffee.waterTareOffset = state.rawWeightGrams;

    // Reset steps back to step 1 (Prep) and arm auto-start if timer isn't running
    if (!state.timer.running && state.brew.phase === 'prep') {
        state.timer.autoStartArmed = elements.chkAutoStart.checked;
        setBrewPhase('prep');
    }
    updateUI();
}

function handleAutoStartChange() {
    state.timer.autoStartArmed = elements.chkAutoStart.checked;
}

// --- Brew Phase Step Rendering ---

function setBrewPhase(phase) {
    state.brew.phase = phase;

    // Set badge text & styles
    elements.brewPhaseBadge.className = `badge badge-${phase}`;
    elements.brewPhaseBadge.textContent = phase === 'prep' ? 'Idle' : phase;

    const steps = [
        { el: elements.stepPrep, num: 1 },
        { el: elements.stepBloom, num: 2 },
        { el: elements.stepBrew, num: 3 },
        { el: elements.stepDrawdown, num: 4 }
    ];

    // Reset all steps to dimmed
    steps.forEach(step => {
        step.el.classList.remove('active-step', 'completed-step');
        step.el.style.opacity = '0.55';
        const numCircle = step.el.querySelector('.phase-step-num');
        numCircle.innerHTML = step.num;
        numCircle.style.background = 'rgba(255, 255, 255, 0.05)';
        numCircle.style.color = 'var(--text-secondary)';
    });

    elements.bloomTimerDisplay.style.display = 'none';

    if (phase === 'prep') {
        elements.stepPrep.classList.add('active-step');
        elements.stepPrep.style.opacity = '1';
        elements.brewSummaryPanel.style.display = 'none';
    } else if (phase === 'bloom') {
        elements.stepPrep.classList.add('completed-step');
        elements.stepPrep.style.opacity = '0.9';
        elements.stepPrep.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';

        elements.stepBloom.classList.add('active-step');
        elements.stepBloom.style.opacity = '1';
        elements.bloomTimerDisplay.style.display = 'block';
    } else if (phase === 'brew') {
        elements.stepPrep.classList.add('completed-step');
        elements.stepPrep.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';
        elements.stepBloom.classList.add('completed-step');
        elements.stepBloom.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';

        elements.stepBrew.classList.add('active-step');
        elements.stepBrew.style.opacity = '1';
    } else if (phase === 'drawdown') {
        elements.stepPrep.classList.add('completed-step');
        elements.stepPrep.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';
        elements.stepBloom.classList.add('completed-step');
        elements.stepBloom.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';
        elements.stepBrew.classList.add('completed-step');
        elements.stepBrew.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';

        elements.stepDrawdown.classList.add('active-step');
        elements.stepDrawdown.style.opacity = '1';
    } else if (phase === 'finished') {
        elements.stepPrep.classList.add('completed-step');
        elements.stepPrep.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';
        elements.stepBloom.classList.add('completed-step');
        elements.stepBloom.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';
        elements.stepBrew.classList.add('completed-step');
        elements.stepBrew.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';
        elements.stepDrawdown.classList.add('completed-step');
        elements.stepDrawdown.querySelector('.phase-step-num').innerHTML = '<i class="fa-solid fa-check"></i>';

        displayBrewSummary();
    }
}

function resetBrewProgress() {
    setBrewPhase('prep');
    elements.brewSummaryPanel.style.display = 'none';
    state.brew.flowRatesRecorded = [];
    if (state.timer.running) {
        stopCoffeeTimer();
    }
    state.timer.seconds = 0;
    elements.coffeeTimer.textContent = '00:00';
    elements.pouroverGaugeFill.style.strokeDashoffset = '754';
}

function displayBrewSummary() {
    const mins = Math.floor(state.timer.seconds / 60);
    const secs = state.timer.seconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const yieldGrams = Math.max(0, state.rawWeightGrams - state.coffee.waterTareOffset);

    let avgFlow = 0.0;
    const rates = state.brew.flowRatesRecorded.filter(r => r > 0.1);
    if (rates.length > 0) {
        avgFlow = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    } else {
        avgFlow = yieldGrams > 5 ? yieldGrams / (state.timer.seconds || 1) : 0.0;
    }

    elements.summaryTotalTime.textContent = timeStr;
    elements.summaryTotalYield.textContent = `${yieldGrams.toFixed(1)}g`;
    elements.summaryAvgFlow.textContent = `${avgFlow.toFixed(1)} g/s`;
    elements.brewSummaryPanel.style.display = 'block';
}

// --- Brew Timer Engine ---

function toggleCoffeeTimer() {
    if (state.timer.running) {
        stopCoffeeTimer();
        if (state.brew.phase === 'brew' || state.brew.phase === 'drawdown') {
            setBrewPhase('finished');
        }
    } else {
        startCoffeeTimer();
        if (state.brew.phase === 'prep') {
            setBrewPhase('bloom');
            startBloomCountdown();
        }
    }
}

function startCoffeeTimer() {
    if (state.timer.running) return;

    state.timer.running = true;
    state.timer.startedAt = Date.now() - (state.timer.seconds * 1000);

    elements.btnCoffeeTimerToggle.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Brew Timer';
    elements.btnCoffeeTimerToggle.style.background = 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)';
    elements.btnCoffeeTimerToggle.style.boxShadow = '0 4px 15px -3px rgba(244, 63, 94, 0.4)';

    state.timer.intervalId = setInterval(() => {
        state.timer.seconds = Math.floor((Date.now() - state.timer.startedAt) / 1000);

        const mins = Math.floor(state.timer.seconds / 60);
        const secs = state.timer.seconds % 60;
        elements.coffeeTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Record flow rates for average calculations
        if (state.flow.rate > 0.1 && (state.brew.phase === 'bloom' || state.brew.phase === 'brew')) {
            state.brew.flowRatesRecorded.push(state.flow.rate);
        }
    }, 1000);
}

function stopCoffeeTimer() {
    if (!state.timer.running) return;

    state.timer.running = false;
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;

    elements.btnCoffeeTimerToggle.innerHTML = '<i class="fa-solid fa-play"></i> Resume Brew Timer';
    elements.btnCoffeeTimerToggle.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    elements.btnCoffeeTimerToggle.style.boxShadow = '0 4px 15px -3px rgba(16, 185, 129, 0.4)';
}

function startBloomCountdown() {
    state.brew.bloomSecondsLeft = 35;
    elements.bloomTimerDisplay.textContent = state.brew.bloomSecondsLeft;

    if (state.brew.bloomTimerId) {
        clearInterval(state.brew.bloomTimerId);
    }

    state.brew.bloomTimerId = setInterval(() => {
        if (state.brew.phase !== 'bloom') {
            clearInterval(state.brew.bloomTimerId);
            return;
        }

        state.brew.bloomSecondsLeft--;
        elements.bloomTimerDisplay.textContent = state.brew.bloomSecondsLeft;

        if (state.brew.bloomSecondsLeft <= 0) {
            clearInterval(state.brew.bloomTimerId);
            if (state.brew.phase === 'bloom') {
                setBrewPhase('brew');
            }
        }
    }, 1000);
}

// --- Live Flow Rate & Auto-Start Logic ---

function handlePouroverTelemetry(weight) {
    const now = Date.now();

    // 1. Sliding window flow calculation
    state.flow.history.push({ time: now, weight: weight });
    state.flow.history = state.flow.history.filter(item => item.time > now - 1200);

    if (state.flow.history.length >= 2) {
        const first = state.flow.history[0];
        const last = state.flow.history[state.flow.history.length - 1];
        const dt = (last.time - first.time) / 1000;
        const dw = last.weight - first.weight;

        if (dt > 0.15) {
            let instantaneousRate = dw / dt;
            if (instantaneousRate < 0.1 && instantaneousRate > -0.1) {
                instantaneousRate = 0.0;
            }
            if (instantaneousRate < 0) {
                instantaneousRate = 0.0;
            }
            // Low-pass exponential moving average filter
            state.flow.rate = state.flow.rate * 0.6 + instantaneousRate * 0.4;
        }
    } else {
        state.flow.rate = 0.0;
    }

    elements.coffeeFlowRate.textContent = state.flow.rate.toFixed(1);

    // 2. Auto-Start Detection
    const currentWaterWeight = Math.max(0, weight - state.coffee.waterTareOffset);

    if (state.timer.autoStartArmed && !state.timer.running && state.brew.phase === 'prep') {
        if (currentWaterWeight > 1.5) {
            state.timer.autoStartArmed = false;
            startCoffeeTimer();
            setBrewPhase('bloom');
            startBloomCountdown();
            console.log("Brew auto-start triggered! Water weight: " + currentWaterWeight.toFixed(1) + "g");
        }
    }

    // 3. Auto Brew Phase Advance
    if (state.timer.running) {
        if (state.brew.phase === 'bloom') {
            // Auto advance bloom if they pour 1.25x past recommended bloom water target early
            if (currentWaterWeight >= state.coffee.bloomWaterGrams * 1.25) {
                clearInterval(state.brew.bloomTimerId);
                setBrewPhase('brew');
            }
        } else if (state.brew.phase === 'brew') {
            // Auto advance to drawdown once 95% of target water weight is reached
            if (currentWaterWeight >= state.coffee.targetWaterGrams * 0.95) {
                setBrewPhase('drawdown');
            }
        }
    }
}

// Reset coffee timer and progress
function resetCoffeeTimer() {
    resetBrewProgress();
}

