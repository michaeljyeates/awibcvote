project(ibceos)

find_package(cdt)

add_contract( ibceos ibceos ibceos.cpp )
target_include_directories( ibceos PUBLIC ${CMAKE_SOURCE_DIR}/../include )
target_ricardian_directory( ibceos ${CMAKE_SOURCE_DIR}/../ricardian )