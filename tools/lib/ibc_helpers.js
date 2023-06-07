const {chainData} = require("./chains");
const WebSocket = require("ws");
const {eosioObj} = require("./eosio_helpers");

const lastProvenBlock = async (destination_chain_name, source_chain_name) => {
    const destination_chain_data = chainData(destination_chain_name);
    const url = `${destination_chain_data.nodeUrl}/v1/chain/get_table_rows`;
    const post_data = JSON.stringify({
        reverse: true,
        json: true,
        code: destination_chain_data.bridgeContract,
        scope: source_chain_name,
        table: 'lastproofs',
        limit: 1
    });
    const res = await fetch(url, {
        method: 'POST',
        body: post_data
    });
    const json = await res.json();
    if (!json.rows.length){
        throw new Error('Could not find last proven block');
    }
    return json.rows[0].block_height;
}

const getProofRequestData = async (source_chain_name, destination_chain_name, tx_id, action_name, type = 'heavyProof') => {
    const chain_data = chainData(source_chain_name);
    const block_data = await getActionBlockData(destination_chain_name, source_chain_name, tx_id, action_name, (type === 'lightProof'));

    return new Promise( (resolve, reject) => {
        //initialize socket to proof server
        const ws = new WebSocket(chain_data.proofSocket);
        ws.addEventListener('open', async (event) => {
            // connected to websocket server
            const query = { type: 'getBlockActions', block_to_prove: block_data.block_to_prove };
            ws.send(JSON.stringify(query));
        });

        ws.addEventListener('error', (event) => {
            console.error(`WebSocket error: ${event.message}`);
        })

        //messages from websocket server
        ws.addEventListener('message', (event) => {
            const res = JSON.parse(event.data);
            //log non-progress messages from ibc server
            if (res.type !=='progress') console.log("Received message from ibc getBlockActions", res);
            if (res.type !=='getBlockActions') return;
            if (res.type === 'error') reject(res.error);
            ws.close();
            const action_receipt = res.txs.filter(t => {
                return t[0].transactionId === tx_id;
            });
            const action_data = action_receipt[0].find(a => {
                return a.receiver === chain_data.voteContract;
            });
            // console.log('action data ', JSON.stringify(action_data, ' ', 2));
            const action = action_data.action;
            action.receipt = action_data.receipt;
            const action_receipt_digest = action_data.action_receipt_digest;
            resolve({type, action, action_receipt_digest, ...block_data});
        });
    });
}
const getActionBlockData = async (destination_chain_name, source_chain_name, tx_id, action_name, light_proof = false) => {
    const chain_data = chainData(source_chain_name);
    const url = `${chain_data['hyperion']}/v2/history/get_transaction?id=${tx_id}`;
    const res = await fetch(url);
    const body = await res.json();
    // console.log(body);
    const action_data = body.actions.find(a => {
        return a.act.name === action_name;
    });
    if (!action_data){
        throw new Error(`Could not find action receipt with name ${action_name}`);
    }

    const data = {block_to_prove: action_data.block_num};
    if (light_proof){
        data.last_proven_block = await lastProvenBlock(destination_chain_name, source_chain_name);
    }
    return data;
}

const getProof = (chain_name, {type, block_to_prove, action, last_proven_block, action_receipt_digest}) => {
    const chain_data = chainData(chain_name);

    return new Promise((resolve, reject) => {
        //initialize socket to proof server
        const ws = new WebSocket(chain_data.proofSocket);
        ws.addEventListener('open', (event) => {
            // connected to websocket server
            const query = { type, block_to_prove };
            if (type === 'lightProof'){
                query.last_proven_block = last_proven_block;
            }
            if (action_receipt_digest) query.action_receipt_digest = action_receipt_digest;
            // if (action) query.action_receipt = action.receipt;
            ws.send(JSON.stringify(query));
            // console.log(JSON.stringify(query, ' ', 4));
        });

        //messages from websocket server
        ws.addEventListener('message', (event) => {
            const res = JSON.parse(event.data);
            //log non-progress messages from ibc server
            if (res.type !=='progress') console.log("Received message from ibc proof server", res);
            // if (res.type =='progress') $('.progressDiv').last().html(res.progress +"%");
            if (res.type === 'error') reject(res.error);
            if (res.type !=='proof') return;
            ws.close();
            resolve(res);
        });
    });
}

const getProveActionData = async (chain_name, request_data, proof_data) => {
    const chain_data = chainData(chain_name);

    // console.log(request_data, proof_data);

    const actionData = {
        authorization: [{
            actor: process.env.IBC_PROOF_ACCOUNT,
            permission: process.env.IBC_PROOF_PERMISSION
        }],
        name: 'prove',
        account: chain_data.proveContract,
        data: { ...proof_data.proof, prover: process.env.IBC_PROOF_ACCOUNT }
    };

    // console.log(request_data);

    let auth_sequence = [];
    // console.log(request_data.action.receipt.auth_sequence);
    for (let authSequence of request_data.action.receipt.auth_sequence) auth_sequence.push({ account: authSequence[0], sequence: authSequence[1] });
    actionData.data.actionproof = {
        ...proof_data.proof.actionproof,
        action: {
            account: request_data.action.account,
            name: request_data.action.name,
            authorization: request_data.action.authorization,
            data: request_data.action.data
        },
        receipt: { ...request_data.action.receipt }
    }

    return actionData;
}

const sendAction = async (chain_name, action_data) => {
    const api = eosioObj(chain_name);
    const result = await api.transact({
        actions: [action_data]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
    return result;
}


module.exports = { lastProvenBlock, getProofRequestData, getActionBlockData, getProof, getProveActionData, sendAction };