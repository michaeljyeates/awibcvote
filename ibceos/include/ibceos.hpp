#include <eosio/eosio.hpp>
using namespace eosio;
using namespace std;

CONTRACT ibceos : public contract {
   public:
      using contract::contract;

      ACTION vote( name planet, vector<name> votes );

      using vote_action = action_wrapper<"vote"_n, &ibceos::vote>;
};