
import FactoryMaker from '../../core/FactoryMaker.js';
import SwitchRequest from './SwitchRequest.js';

const SWITCH_REQUEST_HISTORY_DEPTH = 8; // must be > SwitchHistoryRule SAMPLE_SIZE to enable rule

function SwitchRequestHistory() {
    let switchData = []; // running total
    let srHistory = []; // history of each switch

    function add(switchRequest) {
        let indexDiff = switchRequest.newValue - switchRequest.oldValue;
        let drop = (indexDiff < 0) ? 1 : 0;
        let dropSize = drop ? -indexDiff : 0;
        let noDrop = drop ? 0 : 1;

        switchData[switchRequest.oldValue].drops += drop;
        switchData[switchRequest.oldValue].dropSize += dropSize;
        switchData[switchRequest.oldValue].noDrops += noDrop;
    }

    function subtract(switchRequest) {
        let indexDiff = switchRequest.newValue - switchRequest.oldValue;
        let drop = (indexDiff < 0) ? 1 : 0;
        let dropSize = drop ? -indexDiff : 0;
        let noDrop = drop ? 0 : 1;

        switchData[switchRequest.oldValue].drops -= drop;
        switchData[switchRequest.oldValue].dropSize -= dropSize;
        switchData[switchRequest.oldValue].noDrops -= noDrop;
    }

    function push(switchRequest) {
        if (switchRequest.newValue === SwitchRequest.NO_CHANGE) {
            switchRequest.newValue = switchRequest.oldValue;
        }

        if (!switchData[switchRequest.oldValue]) {
            switchData[switchRequest.oldValue] = {noDrops: 0, drops: 0, dropSize: 0};
        }

        add(switchRequest);
        // Save to history
        srHistory.push(switchRequest);

        // Shift earliest switch off srHistory and readjust to keep depth of running totals constant
        if ( srHistory.length > SWITCH_REQUEST_HISTORY_DEPTH ) {
            let srHistoryFirst = srHistory.shift();
            subtract(srHistoryFirst);
        }
    }

    function getSwitchData() {
        return switchData;
    }

    function getSwitches() {
        return srHistory;
    }

    function reset() {
        switchData = [];
        srHistory = [];
    }

    return {
        push: push,
        getSwitchData: getSwitchData,
        getSwitches: getSwitches,
        reset: reset
    };
}

SwitchRequestHistory.__dashjs_factory_name = 'SwitchRequestHistory';
let factory = FactoryMaker.getClassFactory(SwitchRequestHistory);
export default factory;
