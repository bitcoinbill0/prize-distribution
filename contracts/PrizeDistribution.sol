pragma solidity >=0.4.22 <0.9.0;

import "./lib/SafeMath.sol";

contract PrizeDistribution {

  using SafeMath for uint256;

  struct Competition {
    string title;
    address owner;
    string externalReference;
    mapping (address => uint256) deposits;
    mapping (uint256 => uint256) prizeDistribution;
    mapping (address => bool) prizeDistributionApproved;
    mapping (uint256 => address) playerPositions;
    uint256 depositCount;
    uint256 distributionApprovalRate;
    uint256 entryFee;
    uint256 startBlock;
    uint256 endBlock;
    bool valid;
    bool prizeDistributionLocked;
    bool canceled;
  }

  mapping (uint256 => Competition) competitions;
  uint256 competitionCount = 0;
  uint256 commissionRate;
  uint256 commissionRateLastUpdated;

  constructor(uint256 _commissionRate) public {
    updateCommissionRate(_commissionRate);
  }

  function updateCommissionRate(uint256 _commissionRate) public {
    commissionRate = _commissionRate;
    commissionRateLastUpdated = block.number;
  }

  function getCommissionRate() public view returns (uint256) {
    return commissionRate;
  }

  function createCompetition(
    string memory _title,
    string memory _externalReference,
    uint256 _entryFee,
    uint256 _distributionApprovalRate,
    uint256 _startBlock,
    uint256 _endBlock,
    uint256 _distribution1,
    uint256 _distribution2,
    uint256 _distribution3,
    uint256 _distribution4,
    uint256 _distribution5
  ) public {
    uint256 sumDistCategories = _distribution1.add(_distribution2);
    sumDistCategories = sumDistCategories.add(_distribution3);
    sumDistCategories = sumDistCategories.add(_distribution4);
    sumDistCategories = sumDistCategories.add(_distribution5);
    require(sumDistCategories == 100,
      "The prize distribution must total 100%.");
    Competition memory competition;
    competition.prizeDistributionLocked = false;
    competition.valid = true;
    competition.canceled = false;
    competition.owner = msg.sender;
    competition.title = _title;
    competition.externalReference = _externalReference;
    competition.entryFee = _entryFee;
    competition.startBlock = _startBlock;
    competition.endBlock = _endBlock;
    competition.distributionApprovalRate = _distributionApprovalRate;
    competitions[competitionCount] = competition;
    competitions[competitionCount].prizeDistribution[0] = _distribution1;
    competitions[competitionCount].prizeDistribution[1] = _distribution2;
    competitions[competitionCount].prizeDistribution[2] = _distribution3;
    competitions[competitionCount].prizeDistribution[3] = _distribution4;
    competitions[competitionCount].prizeDistribution[4] = _distribution5;
    competitionCount += 1;
  }

  function enterCompetition(
    uint256 _competitionId
  ) public payable {
    Competition storage competition = competitions[_competitionId];
    require(competition.valid, "The competition does not exist.");
    require(msg.value == competition.entryFee,
      "You must deposit the exact entry fee in Ether.");
    require(competition.deposits[msg.sender] == 0x0,
      "You have already entered this competition.");
    competition.deposits[msg.sender] = msg.value;
    competition.depositCount += 1;
  }

  function cancelCompetition(
    uint256 _competitionId
  ) public {
    Competition storage competition = competitions[_competitionId];
    require(competition.valid, "The competition does not exist.");
    require(competition.owner == msg.sender,
      "Only the owner of a competition can cancel it.");
    require(competition.startBlock > block.number,
      "You cannot cancel the competition because it has already started.");
    require(!competition.canceled,
      "The competition has already been canceled.");
    competition.canceled = true;
  }

  function returnEntryFee(
    uint256 _competitionId,
    address payable _player
  ) public {
    Competition storage competition = competitions[_competitionId];
    require(competition.valid, "The competition does not exist.");
    require(competition.canceled, "The competition has not been canceled.");
    uint256 playerDeposit = competition.deposits[_player];
    require(playerDeposit > 0, "There is nothing to return to this player.");
    _player.transfer(playerDeposit);
    competitions[_competitionId].deposits[_player] = 0;
  }

  function approvePrizeDistribution(
    uint256 _competitionId
  ) public {
    Competition storage competition = competitions[_competitionId];
    require(competition.valid, "The competition does not exist.");
    require(competition.prizeDistributionLocked,
      "The prize distribution has not been locked yet.");
    // TODO - approve the prize distribution if the comp has ended and the sender entered the competition
  }

  function withdrawPrize(
    uint256 _competitionId
  ) public {
    Competition storage competition = competitions[_competitionId];
    require(competition.valid, "The competition does not exist.");
    // TODO - send the prize to the sender if they entered the competition and have not already claime their prize
  }

  function() external payable {
    revert("You must not send Ether directly to this contract.");
  }
}