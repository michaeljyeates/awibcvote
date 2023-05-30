#include <eosio/eosio.hpp>
#include <bridge.hpp>
using namespace eosio;
using namespace std;

CONTRACT ibcwax : public contract {
    private:
        // for bridge communication
        TABLE hpstruct {
            uint64_t id;
            bridge::heavyproof hp;
            uint64_t primary_key()const { return id; }
            EOSLIB_SERIALIZE( hpstruct, (id)(hp) )
        } _heavy_proof_obj;

        using hptable = eosio::singleton<"heavyproof"_n, hpstruct>;

        hptable _heavy_proof;

        TABLE processed {
            uint64_t                        id;
            checksum256                     receipt_digest;

            uint64_t primary_key()const { return id; }
            checksum256 by_digest()const { return receipt_digest; }

            EOSLIB_SERIALIZE( processed, (id)(receipt_digest))
        };

        void check_processed(const bridge::actionproof& actionproof, const name& payer);

        struct [[eosio::table]] global {
            name          bridge_contract;
            checksum256   paired_chain_id;
            name          paired_vote_contract;
            name          dao_contract;
        } globalrow;

    public:
        using contract::contract;

        void init(const name& bridge_contract, const checksum256& paired_chain_id, const name& paired_vote_contract, const name& dao_contract);
        void prove( const name& prover, const bridge::heavyproof blockproof, const bridge::actionproof actionproof );

        using heavyproof_action = action_wrapper<"checkproofb"_n, &bridge::checkproofb>;
        using init_action = action_wrapper<"init"_n, &ibcwax::init>;
        using prove_action = action_wrapper<"prove"_n, &ibcwax::prove>;

        typedef eosio::multi_index< "processed"_n, processed,
            indexed_by<"digest"_n, const_mem_fun<processed, checksum256, &processed::by_digest>>> processedtable;
        processedtable _processedtable;

        using globaltable = eosio::singleton<"global"_n, global>;
        globaltable global_config;

        struct vote {
            name         planet;
            vector<name> votes;
        };

        ibcwax( name receiver, name code, datastream<const char*> ds ) :
        contract(receiver, code, ds),
        global_config(_self, _self.value),
        _processedtable(_self, _self.value),
        _heavy_proof(receiver, receiver.value)
        { }
};