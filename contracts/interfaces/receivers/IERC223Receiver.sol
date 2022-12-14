// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;


interface IERC223Receiver {
  function tokenFallback(address, uint256, bytes calldata) external;
}
