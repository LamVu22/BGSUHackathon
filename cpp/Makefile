CXX ?= g++
CXXFLAGS ?= -O2 -std=c++20 -Wall -Wextra -pedantic -fopenmp
LDFLAGS ?=
LIBS ?= -lcurl -lc++ -lc++abi

SRC_DIR := src
OBJ_DIR := build
TARGET := bgsu_crawler

SRCS := $(wildcard $(SRC_DIR)/*.cpp)
OBJS := $(patsubst $(SRC_DIR)/%.cpp,$(OBJ_DIR)/%.o,$(SRCS))

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) $(OBJS) -o $@ $(LDFLAGS) $(LIBS)

$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)

$(OBJ_DIR)/%.o: $(SRC_DIR)/%.cpp | $(OBJ_DIR)
	$(CXX) $(CXXFLAGS) -Iinclude -c $< -o $@

clean:
	rm -rf $(OBJ_DIR) $(TARGET)

.PHONY: all clean
