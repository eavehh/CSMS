"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
function App() {
    var _this = this;
    var _a = (0, react_1.useState)(null), data = _a[0], setData = _a[1];
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    var BASE_URL = 'http://localhost:8081';
    var apiCall = function (url_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([url_1], args_1, true), void 0, function (url, options) {
            var res, result, err_1;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setLoading(true);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(url, options)];
                    case 2:
                        res = _a.sent();
                        return [4 /*yield*/, res.json()];
                    case 3:
                        result = _a.sent();
                        setData(result);
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _a.sent();
                        setData({ error: err_1.message });
                        return [3 /*break*/, 5];
                    case 5:
                        setLoading(false);
                        return [2 /*return*/];
                }
            });
        });
    };
    var getStations = function () { return apiCall("".concat(BASE_URL, "/api/stations")); };
    var getTransactions = function () { return apiCall("".concat(BASE_URL, "/api/transactions")); };
    var getMetrics = function (id) { return apiCall("".concat(BASE_URL, "/api/metrics/").concat(id)); };
    var getAdminStations = function () { return apiCall("".concat(BASE_URL, "/api/admin/stations")); };
    var postStartSession = function () {
        var body = {
            chargePointId: 'CP_001',
            connectorId: 1,
            idTag: 'USER_123',
            limitType: 'full',
            limitValue: 10,
            tariffPerKWh: 0.1
        };
        apiCall("".concat(BASE_URL, "/api/start-session"), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    };
    var postStopSession = function () {
        var body = {
            transactionId: 'tx_id_example',
            chargePointId: 'CP_001',
            connectorId: 1,
            idTag: 'USER_123',
            meterStop: 5,
            timestamp: new Date().toISOString(),
            reason: 'Local'
        };
        apiCall("".concat(BASE_URL, "/api/stop-session"), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    };
    var postReserve = function () {
        var body = {
            chargePointId: 'CP_001',
            connectorId: 1,
            idTag: 'USER_123',
            expiryMinutes: 30
        };
        apiCall("".concat(BASE_URL, "/api/reserve"), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    };
    var postAdminConnect = function () {
        var body = {
            stationId: 'CP_001',
            connectorId: 1
        };
        apiCall("".concat(BASE_URL, "/api/admin/connect"), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    };
    return (react_1.default.createElement("div", null,
        react_1.default.createElement("h1", null, "CSMS API Frontend"),
        react_1.default.createElement("h3", null, "GET Requests"),
        react_1.default.createElement("button", { onClick: getStations }, "Stations"),
        react_1.default.createElement("button", { onClick: getTransactions }, "Transactions"),
        react_1.default.createElement("button", { onClick: getAdminStations }, "Admin Stations"),
        react_1.default.createElement("h3", null, "POST Requests"),
        react_1.default.createElement("button", { onClick: postStartSession }, "Start Session"),
        react_1.default.createElement("button", { onClick: postStopSession }, "Stop Session"),
        react_1.default.createElement("button", { onClick: postReserve }, "Reserve"),
        react_1.default.createElement("button", { onClick: postAdminConnect }, "Admin Connect"),
        loading && react_1.default.createElement("p", null, "Loading..."),
        data && (react_1.default.createElement("pre", null, JSON.stringify(data, null, 2)))));
}
exports.default = App;
