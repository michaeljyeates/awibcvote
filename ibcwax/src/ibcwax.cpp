#include <ibcwax.hpp>

void ibcwax::check_processed(const bridge::actionproof& actionproof, const name& payer){
    auto pid_index = _processedtable.get_index<"digest"_n>();

    std::vector<char> serialized_receipt = pack(actionproof.receipt);
    checksum256 action_receipt_digest = sha256(serialized_receipt.data(), serialized_receipt.size());

    auto p_itr = pid_index.find(action_receipt_digest);

    check(p_itr == pid_index.end(), "action already proved");

    _processedtable.emplace( payer, [&]( auto& s ) {
        s.id = _processedtable.available_primary_key();
        s.receipt_digest = action_receipt_digest;
    });
}

ACTION ibcwax::init(const name& bridge_contract, const checksum256& paired_chain_id, const name& paired_vote_contract, const name& dao_contract)
{
    check(!global_config.exists(), "contract already initialized");

    require_auth( get_self() );

    check( is_account( bridge_contract ), "bridge_contract account does not exist" );

    auto global = global_config.get_or_create(get_self(), globalrow);
    global.bridge_contract = bridge_contract;
    global.paired_chain_id = paired_chain_id;
    global.paired_vote_contract = paired_vote_contract;
    global.dao_contract = dao_contract;
    global_config.set(global, get_self());
}

ACTION ibcwax::prove( const name& prover, const bridge::heavyproof blockproof, const bridge::actionproof actionproof ) {
    require_auth(prover);

    check(global_config.exists(), "contract must be initialized first");
    auto global = global_config.get();

    // Make sure this has not been proven before
    check_processed(actionproof, prover);

    // Check proof is from the correct chain
    check(blockproof.chain_id == global.paired_chain_id, "proof chain does not match paired chain");

    // check proved action is on the correct contract
    check(global.paired_vote_contract == actionproof.action.account, "Action proof not from correct contract");

    // Save blockproof to singleton to be read by check action
    auto p = _heavy_proof.get_or_create(get_self(), _heavy_proof_obj);
    p.hp = blockproof;
    _heavy_proof.set(p, get_self());

    // Send inline action to verify proof (will assert entire tx if invalid)
    ibcwax::heavyproof_action checkproof_act(global.bridge_contract, permission_level{get_self(), "active"_n});
    checkproof_act.send(get_self(), actionproof);

    // Cast vote
    ibcwax::vote vote_act = unpack<ibcwax::vote>(actionproof.action.data);
    action(permission_level{get_self(), "active"_n}, global.dao_contract, "votecust"_n, make_tuple(get_self(), vote_act.votes, vote_act.planet))
            .send();
}