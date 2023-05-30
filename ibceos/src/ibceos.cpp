#include <ibceos.hpp>
ACTION ibceos::vote( name planet, vector<name> votes ) {
   /* dont do anything because this action will be used to verify on wax */
   require_auth(get_self());
   check(votes.size() == 2, "You must vote for exactly 2 candidates");
}