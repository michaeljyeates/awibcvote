project(ibcwax)

find_package(cdt)

add_contract( ibcwax ibcwax ibcwax.cpp )
target_include_directories( ibcwax PUBLIC ${CMAKE_SOURCE_DIR}/../include )
target_ricardian_directory( ibcwax ${CMAKE_SOURCE_DIR}/../ricardian )