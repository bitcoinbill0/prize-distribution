const PrizeDistribution = artifacts.require("PrizeDistribution");
const _ = require("lodash");
const timeMachine = require('ganache-time-traveler');

contract("PrizeDistribution", accounts => {

  const BigNumber = web3.utils.BN;

  const createCompetition = async (
    blockNumber,
    startBlock,
    endBlock,
    entryFee
  ) => {
    await this.prizeDistribution.createCompetition(
      "Vega Trading Competition",
      "GBP/USD Feb 21",
      entryFee ? entryFee : web3.utils.toWei("0.1"),
      startBlock ? new BigNumber(startBlock) : new BigNumber(blockNumber + 8),
      endBlock ? new BigNumber(endBlock) : new BigNumber(blockNumber + 10)
    );
  };

  before(async () => {
    this.prizeDistribution = await PrizeDistribution.new(
      new BigNumber(5),
      new BigNumber(4)
    );
  });

  it("should init the PrizeDistribution contract correctly",
    async () => {
      const commissionRate = await this.prizeDistribution.getCommissionRate.call();
      assert.equal(commissionRate.toNumber(), 5);
    }
  );

  it("should create a new competition",
    async() => {
      const blockNumber = await web3.eth.getBlockNumber();
      await createCompetition(blockNumber);
      const competition = await this.prizeDistribution.getCompetition.call(0);
      assert.equal(competition[0], "Vega Trading Competition");
      assert.equal(competition[1], accounts[0]);
      assert.equal(competition[2], "GBP/USD Feb 21");
      assert.equal(web3.utils.fromWei(competition[3]), 0.1);
      assert.equal(competition[4].toNumber(), blockNumber + 8);
      assert.equal(competition[5].toNumber(), blockNumber + 10);
      assert.equal(competition[6], false);
    }
  );

  it("should not create competition with entry fee of zero",
    async () => {
      try {
        const blockNumber = await web3.eth.getBlockNumber();
        await createCompetition(blockNumber, null, null, web3.utils.toWei("0"));
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "There must be a fee to enter the competition."), true);
      }
    }
  );

  it("should not create competition with start block in the past",
    async () => {
      try {
        const blockNumber = await web3.eth.getBlockNumber();
        await createCompetition(blockNumber, blockNumber - 1);
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The start block must be after the current block."), true);
      }
    }
  );

  it("should not create competition with end block before start block",
    async () => {
      try {
        const blockNumber = await web3.eth.getBlockNumber();
        await createCompetition(blockNumber, blockNumber + 5, blockNumber + 3);
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The end block must be after the start block."), true);
      }
    }
  );

  it("should fail to get an invalid competition by ID",
    async () => {
      try {
        await this.prizeDistribution.getCompetition(999);
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The competition does not exist."), true);
      }
    }
  );

  it("should get competition count",
    async () => {
      const count = await this.prizeDistribution.getCompetitionCount();
      assert.equal(count.toNumber() > 0, true);
    }
  );

  it("should fail to cancel non-existent competition",
    async () => {
      try {
        await this.prizeDistribution.cancelCompetition(999);
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The competition does not exist."), true);
      }
    }
  );

  it("should fail to cancel competition when not owner",
    async () => {
      try {
        await this.prizeDistribution.cancelCompetition(0, {
          from: accounts[1]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "Only the owner of a competition can cancel it."), true);
      }
    }
  );

  it("should fail to cancel competition when already started",
    async () => {
      await timeMachine.advanceTimeAndBlock(60);
      await timeMachine.advanceTimeAndBlock(60);
      await timeMachine.advanceTimeAndBlock(60);
      try {
        await this.prizeDistribution.cancelCompetition(0, {
          from: accounts[0]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "You cannot cancel the competition because it has already started."), true);
      }
    }
  );

  it("should allow player to enter competition",
    async() => {
      const blockNumber = await web3.eth.getBlockNumber();
      await createCompetition(blockNumber);
      await this.prizeDistribution.enterCompetition(1, {
        from: accounts[0],
        value: web3.utils.toWei("0.1")
      });
      const competition = await this.prizeDistribution.getCompetition.call(1);
      assert.equal(competition[7].toNumber(), 1);
      assert.equal(0.1, web3.utils.fromWei(
        await web3.eth.getBalance(this.prizeDistribution.address)
      ));
    }
  );

  it("should cancel competition when owner",
    async () => {
      const blockNumber = await web3.eth.getBlockNumber();
      createCompetition(blockNumber);
      await this.prizeDistribution.cancelCompetition(1, {
        from: accounts[0]
      });
      const competition = await this.prizeDistribution.getCompetition.call(1);
      assert.equal(competition[6], true);
    }
  );

  it("should fail to cancel competition when already canceled",
    async () => {
      try {
        await this.prizeDistribution.cancelCompetition(1, {
          from: accounts[0]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The competition has already been canceled."), true);
      }
    }
  );

  it("should not allow player to enter competition when full",
    async() => {
      const blockNumber = await web3.eth.getBlockNumber();
      createCompetition(blockNumber, blockNumber + 8, blockNumber + 12);
      const count = await this.prizeDistribution.getCompetitionCount();
      const competitionId = count.toNumber() - 1;
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[1],
        value: web3.utils.toWei("0.1")
      });
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[3],
        value: web3.utils.toWei("0.1")
      });
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[7],
        value: web3.utils.toWei("0.1")
      });
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[8],
        value: web3.utils.toWei("0.1")
      });
      const competition = await this.prizeDistribution.getCompetition.call(competitionId);
      assert.equal(competition[7].toNumber(), 4);
      try {
        await this.prizeDistribution.enterCompetition(competitionId, {
          from: accounts[2],
          value: web3.utils.toWei("0.1")
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "This competition is already full."), true);
      }
    }
  );

  it("should not allow player to enter competition more than once",
    async() => {
      const blockNumber = await web3.eth.getBlockNumber();
      createCompetition(blockNumber, blockNumber + 8, blockNumber + 12);
      const count = await this.prizeDistribution.getCompetitionCount();
      const competitionId = count.toNumber() - 1;
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[1],
        value: web3.utils.toWei("0.1")
      });
      try {
        await this.prizeDistribution.enterCompetition(competitionId, {
          from: accounts[1],
          value: web3.utils.toWei("0.1")
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "You have already entered this competition."), true);
      }
    }
  );

  it("should not allow player to enter competition with incorrect fee",
    async() => {
      try {
        await this.prizeDistribution.enterCompetition(2, {
          from: accounts[1],
          value: web3.utils.toWei("0.099")
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "You must deposit the exact entry fee in Ether."), true);
      }
    }
  );

  it("should not allow player to enter non-existent competition",
    async() => {
      try {
        await this.prizeDistribution.enterCompetition(999, {
          from: accounts[1],
          value: web3.utils.toWei("0.1")
        });      const blockNumber = await web3.eth.getBlockNumber();
      createCompetition(blockNumber);
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The competition does not exist."), true);
      }
    }
  );

  it("should not allow player to enter canceled competition",
    async() => {
      try {
        await this.prizeDistribution.enterCompetition(1, {
          from: accounts[1],
          value: web3.utils.toWei("0.1")
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "This competition has been canceled."), true);
      }
    }
  );

  it("should not allow player to enter started competition",
    async() => {
      try {
        await this.prizeDistribution.enterCompetition(0, {
          from: accounts[1],
          value: web3.utils.toWei("0.1")
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "This competition has already started."), true);
      }
    }
  );

  it("should fail to receive Ether sent to the contract",
    async () => {
      try {
        await this.prizeDistribution.sendTransaction({
            value: web3.utils.toWei("0.1"),
            from: accounts[0]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "You must not send Ether directly to this contract."), true);
      }
    }
  );

  it("should withdraw commission",
    async() => {
      const blockNumber = await web3.eth.getBlockNumber();
      createCompetition(blockNumber, blockNumber + 3, blockNumber + 4);
      const count = await this.prizeDistribution.getCompetitionCount();
      const competitionId = count.toNumber() - 1;
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[0],
        value: web3.utils.toWei("0.1")
      });
      let competition = await this.prizeDistribution.getCompetition.call(competitionId);
      assert.equal(competition[7].toNumber(), 1);
      try {
        await this.prizeDistribution.withdrawCommission(competitionId, {
          from: accounts[8]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The competition has not started yet."), true);
      }
      await timeMachine.advanceTimeAndBlock(60);
      const ownerBalanceBefore = await web3.eth.getBalance(await this.prizeDistribution.owner());
      await this.prizeDistribution.withdrawCommission(competitionId, {
        from: accounts[8]
      });
      const ownerBalanceAfter = await web3.eth.getBalance(await this.prizeDistribution.owner());
      assert.equal((Number(web3.utils.fromWei(ownerBalanceBefore)) + 0.0005).toFixed(2), Number(web3.utils.fromWei(ownerBalanceAfter)).toFixed(2));
    }
  );

  it("should not withdraw commission when already withdrawn",
    async() => {
      const count = await this.prizeDistribution.getCompetitionCount();
      const competitionId = count.toNumber() - 1;
      const ownerBalanceBefore = await web3.eth.getBalance(await this.prizeDistribution.owner());
      try {
        await this.prizeDistribution.withdrawCommission(competitionId, {
          from: accounts[8]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The commission has already been paid out."), true);
      }
      const ownerBalanceAfter = await web3.eth.getBalance(await this.prizeDistribution.owner());
      assert.equal(Number(web3.utils.fromWei(ownerBalanceBefore)).toFixed(2), Number(web3.utils.fromWei(ownerBalanceAfter)).toFixed(2));
    }
  );

  it("should submit the player ranks",
    async () => {
      const blockNumber = await web3.eth.getBlockNumber();
      createCompetition(blockNumber, blockNumber + 5, blockNumber + 7);
      const count = await this.prizeDistribution.getCompetitionCount();
      const competitionId = count.toNumber() - 1;
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[0],
        value: web3.utils.toWei("0.1")
      });
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[1],
        value: web3.utils.toWei("0.1")
      });
      await this.prizeDistribution.enterCompetition(competitionId, {
        from: accounts[2],
        value: web3.utils.toWei("0.1")
      });
      let competition = await this.prizeDistribution.getCompetition.call(competitionId);
      assert.equal(competition[7].toNumber(), 3);
      try {
        await this.prizeDistribution.submitPlayersByRank(competitionId, [], {
          from: accounts[0]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "You must submit ranks for every player in the competition."), true);
      }
      try {
        await this.prizeDistribution.submitPlayersByRank(competitionId, [accounts[0], accounts[1], accounts[2]], {
          from: accounts[0]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "The competition has not finished yet."), true);
      }
      await timeMachine.advanceTimeAndBlock(60);
      await timeMachine.advanceTimeAndBlock(60);
      try {
        await this.prizeDistribution.submitPlayersByRank(competitionId, [accounts[0], accounts[1], accounts[3]], {
          from: accounts[0]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "You submitted a player that has not entered the competition."), true);
      }
      await this.prizeDistribution.submitPlayersByRank(competitionId, [accounts[0], accounts[1], accounts[2]], {
        from: accounts[0]
      });
      const distribution = await this.prizeDistribution.getPrizeDistribution(competitionId);
      assert.equal(distribution.length, 3);
      const prizePool = 0.3 * 0.995;
      const constantPool = prizePool * 0.5;
      const variablePool = prizePool * 0.5;
      assert.equal(Number(web3.utils.fromWei(distribution[0])).toFixed(5), ((variablePool * 0.25) + (constantPool / 3)).toFixed(5));
      assert.equal(Number(web3.utils.fromWei(distribution[1])).toFixed(5), ((variablePool * 0.25) + (constantPool / 3)).toFixed(5));
      assert.equal(Number(web3.utils.fromWei(distribution[2])).toFixed(5), ((variablePool * 0.5) + (constantPool / 3)).toFixed(5));
    }
  );

  it("should fail to update commission rate when over 1000",
    async() => {
      try {
        await this.prizeDistribution.updateCommissionRate(1001, {
          from: accounts[0]
        });
        assert.fail();
      } catch(e) {
        assert.equal(_.includes(JSON.stringify(e),
          "Commission rate must be <= 1000."), true);
      }
    }
  );

  it("should withdraw prizes",
    async () => {
      const count = await this.prizeDistribution.getCompetitionCount();
      const competitionId = count.toNumber() - 1;
      const balanceBefore1 = await web3.eth.getBalance(accounts[0]);
      const balanceBefore2 = await web3.eth.getBalance(accounts[1]);
      const balanceBefore3 = await web3.eth.getBalance(accounts[2]);
      await this.prizeDistribution.withdrawPrizes(competitionId, {
        from: accounts[0]
      });
      const balanceAfter1 = await web3.eth.getBalance(accounts[0]);
      const balanceAfter2 = await web3.eth.getBalance(accounts[1]);
      const balanceAfter3 = await web3.eth.getBalance(accounts[2]);
      const prizePool = 0.3 * 0.995;
      const constantPool = prizePool * 0.5;
      const variablePool = prizePool * 0.5;
      assert.equal(Number(web3.utils.fromWei(balanceAfter1)).toFixed(5), (Number(web3.utils.fromWei(balanceBefore1)) + (variablePool * 0.25) + (constantPool / 3)).toFixed(5));
      assert.equal(Number(web3.utils.fromWei(balanceAfter2)).toFixed(5), (Number(web3.utils.fromWei(balanceBefore2)) + (variablePool * 0.25) + (constantPool / 3)).toFixed(5));
      assert.equal(Number(web3.utils.fromWei(balanceAfter3)).toFixed(5), (Number(web3.utils.fromWei(balanceBefore3)) + (variablePool * 0.5) + (constantPool / 3)).toFixed(5));
    }
  );

  it("should not withdraw prizes when ranks are not set",
    async () => {
      // TODO - test this
    }
  );

  it("should not withdraw prizes when already paid",
    async () => {
      // TODO - test this
    }
  );

  it("should not withdraw prizes when competition is cancelled",
    async () => {
      // TODO - test this
    }
  );
});
