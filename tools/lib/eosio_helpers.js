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

const transactionFinal = async (chain_name, tx_id, block_num = 0) => {
    console.log(`Checking tx status for ${tx_id}`);
    const chain_data = chainData(chain_name);

    const url = `${chain_data.nodeUrl}/v1/chain/get_transaction_status`;
    const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            id: tx_id
        })
    });
    const json = await res.json();
    // console.log(json);
    if (json.state === 'UNKNOWN' && block_num){
        console.log('Checking last irreversible block');
        if (block_num < json.irreversible_number){
            console.log('TX is earlier then last irreversible');
            return true;
        }
    }

    return json.state === 'IRREVERSIBLE';
}


module.exports = { eosioObj, transactionFinal };