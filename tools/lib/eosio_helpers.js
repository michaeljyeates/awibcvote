const {chainData} = require("./chains");
const {JsSignatureProvider} = require("eosjs/dist/eosjs-jssig");
const {JsonRpc, Api} = require("eosjs");

const eosioObj = (chain_name) => {
    const chain_data = chainData(chain_name);

    const signatureProvider = new JsSignatureProvider([process.env.IBC_PROOF_PRIVATE_KEY]);
    const rpc = new JsonRpc(chain_data.nodeUrl, { fetch });
    const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

    return api;
}


module.exports = { eosioObj };