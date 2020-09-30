var expect = require('chai').expect;
const BN = web3.utils.BN
const truffleAssert = require('truffle-assertions');
const { createKitty, setOperator } = require('./kittyUtils');

const KittyMarketPlace = artifacts.require("KittyMarketPlace");
const TestKittyMarketPlace = artifacts.require("TestKittyMarketPlace");
const TestKittyContract = artifacts.require("TestKittyContract");



contract('KittyMarketPlace', (accounts) => {
    let kittyContract;
    let kittyMarketPlace;
    const contractOwner = accounts[0];

    // market transaction type strings
    const transTypes = {
        create: 'Create offer',
        remove: 'Remove offer',
        buy: 'Buy',
    };

    // revert messages. truffle-asserts matches using "contains"
    const noRevertMessage = truffleAssert.ErrorType.REVERT;
    const revertMsg = {
        buyKitty: {
            price: 'price',
            notActive: 'active'
        },
        getOffer: {
            notActive: 'active'
        },
        setOffer: {
            notOwner: 'owner',
            alreadyActive: 'sell twice',
            notApproved: 'approve'
        },
        removeOffer: {
            notOwner: 'not seller'
        }
    };

    async function createContracts() {
        kittyContract = await TestKittyContract.new();
        kittyMarketPlace = await TestKittyMarketPlace.new(kittyContract.address);
    }

    async function initContracts() {
        await createContracts();
        await kittyMarketPlace.setKittyContract(
            kittyContract.address, { from: contractOwner });
    }

    function setOffer(price, kitty, _from) {
        _from = _from || kitty.owner;
        return kittyMarketPlace.setOffer(
            price, kitty.kittyId, { from: _from });
    }

    /*
     * Wrapper functions
    */
    function buyKitty(kitty, buyer, _value) {
        return kittyMarketPlace.buyKitty(
            kitty.kittyId, { from: buyer, value: _value });
    }

    function expectOffer(result, expected) {
        expect(result.seller).to.equal(expected.seller);
        expect(result.price.toString(10)).to.equal(expected.price.toString(10));
        expect(result.index.toString(10)).to.equal(expected.index.toString(10));
        expect(result.tokenId.toString(10)).to.equal(expected.tokenId.toString(10));
        expect(result.active).to.equal(expected.active);
    }

    function hasActiveOffer(tokenId) {
        return kittyMarketPlace.hasActiveOffer(tokenId);
    }

    describe('Init', () => {

        it('should be deployed', async () => {
            const deployed = await KittyMarketPlace.deployed();
            expect(deployed).to.exist;
        });

        describe('set kitty contract', () => {
            beforeEach(async () => {
                await createContracts();
            });

            it('should set the kitty contract instance', async () => {
                await kittyMarketPlace.setKittyContract(
                    kittyContract.address, { from: contractOwner });

                const result = await kittyMarketPlace.getKittyContractAddress();
                expect(result).to.equal(kittyContract.address);
            });

            it('should REVERT if NOT called by the contract owner', async () => {
                await truffleAssert.reverts(
                    kittyMarketPlace.setKittyContract(
                        kittyContract.address, { from: accounts[1] })
                );
            });
        });
    });

    describe('Market', () => {
        let kitty;
        let kittyOwner;
        beforeEach(async () => {
            await initContracts();
            kittyOwner = accounts[1];
            kitty = {
                kittyId: new BN('1'),
                mumId: new BN('0'),
                dadId: new BN('0'),
                generation: new BN('0'),
                genes: new BN('1234567812345678'),
                owner: kittyOwner,
            }
            await createKitty(kittyContract, kitty);
            await setOperator(kittyContract, kittyOwner, kittyMarketPlace.address);
        });

        function expectMarketEvent(result, txType, sender, tokenId) {
            truffleAssert.eventEmitted(
                result,
                "MarketTransaction",
                event => event.TxType === txType &&
                    event.owner === sender &&
                    event.tokenId.toString(10) === tokenId.toString(10)
            );
        }

        describe('Set offer', () => {

            function testSetOffer(offerFn, transType) {
                describe('common', () => {
                    it('should REVERT if the market contract is not an approved operator for the sender', async () => {
                        await kittyContract.setApprovalForAll(
                            kittyMarketPlace.address, false, { from: kittyOwner });

                        await truffleAssert.reverts(
                            offerFn(new BN('1'), kitty),
                            truffleAssert.ErrorType.REVERT,
                            "operator"
                        );
                    });

                    it('should create a new offer for the token at the given price', async () => {
                        const expOffer = {
                            seller: kitty.owner,
                            price: new BN('100'),
                            index: new BN('0'),
                            tokenId: kitty.kittyId,
                            active: true
                        };

                        await offerFn(expOffer.price, kitty);

                        const result = await kittyMarketPlace.getOffer(kitty.kittyId);
                        expectOffer(result, expOffer);
                    });

                    it(`should emit a MarketTransaction event with type "${transType}"`, async () => {
                        const res = await offerFn(new BN('200'), kitty);

                        expectMarketEvent(
                            res, transType, kitty.owner, kitty.kittyId
                        );
                    });

                    it('should REVERT if the sender is not the token owner', async () => {
                        const scammer = accounts[3];
                        await kittyContract.setApprovalForAll(
                            kittyMarketPlace.address, true, { from: scammer });

                        await truffleAssert.reverts(
                            offerFn(new BN('1'), kitty, scammer),
                            truffleAssert.ErrorType.REVERT,
                            "owner"
                        );
                    });

                    it('should REVERT if there is an existing offer for the token', async () => {
                        await offerFn(new BN('200'), kitty);

                        await truffleAssert.reverts(
                            offerFn(new BN('300'), kitty),
                            truffleAssert.ErrorType.REVERT,
                            "duplicate"
                        );
                    });
                });
            }

            describe('Sell', () => {
                testSetOffer(setOffer, transTypes.create);
            });

            describe('Get Offer', () => {

                it('should get the offer for the token', async () => {
                    const expOffer = {
                        seller: kitty.owner,
                        price: new BN('100'),
                        index: new BN('0'),
                        tokenId: kitty.kittyId,
                        active: true
                    };

                    await setOffer(expOffer.price, kitty);

                    const result = await kittyMarketPlace.getOffer(kitty.kittyId);
                    expectOffer(result, expOffer);
                });

                it('should REVERT if there is no active offer for that token', async () => {
                    await truffleAssert.reverts(
                        kittyMarketPlace.getOffer(kitty.kittyId)
                    );
                });
            });
        });

        describe('Remove Offer', () => {
            beforeEach(async () => {
                await setOffer(new BN('100'), kitty);
            });

            it('should set the offer.active to false', async () => {
                await kittyMarketPlace.removeOffer(
                    kitty.kittyId, { from: kitty.owner });

                const result = await hasActiveOffer(kitty.kittyId);
                expect(result).to.equal(false);
            });

            it('should emit a MarketTransaction event of type "Remove"', async () => {
                const res = await kittyMarketPlace.removeOffer(
                    kitty.kittyId, { from: kitty.owner });

                expectMarketEvent(
                    res, transTypes.remove, kitty.owner, kitty.kittyId
                );
            });

            it('should REVERT if sender is not the seller', async () => {
                const scammer = accounts[3];
                await truffleAssert.reverts(
                    kittyMarketPlace.removeOffer(
                        kitty.kittyId, { from: scammer })
                );
            });
        });

        describe('Execute offer', () => {
            let expPrice;
            let buyer = accounts[2];
            beforeEach(async () => {
                expPrice = new BN('100000');
                buyer = accounts[2];
            });

            function testExecuteOffer(offerFn, exeOfferFn, txType, matron) {

                describe('common', () => {

                    beforeEach(async () => {
                        await offerFn(expPrice, kitty);
                    });

                    it('should send funds to the seller', async () => {
                        const buyerBalBefore = new BN(await web3.eth.getBalance(buyer));
                        const sellerBalBefore = new BN(await web3.eth.getBalance(kitty.owner));

                        await exeOfferFn(kitty, buyer, expPrice, matron);

                        const buyerBalAfter = new BN(await web3.eth.getBalance(buyer));
                        const expBuyerBal = buyerBalBefore.sub(expPrice);
                        expect(buyerBalAfter.lte(expBuyerBal));

                        const sellerBalAfter = new BN(await web3.eth.getBalance(kitty.owner));
                        const expSellerBal = sellerBalBefore.add(expPrice);
                        expect(sellerBalAfter.toString(10)).to.equal(expSellerBal.toString(10));
                    });

                    it('should set the offer as inactive', async () => {
                        await exeOfferFn(kitty, buyer, expPrice, matron);

                        const result = await kittyMarketPlace.hasActiveOffer(kitty.kittyId);
                        expect(result).to.equal(false);
                    });

                    it(`should emit a MarketTransaction event of type "${txType}"`, async () => {
                        const result = await exeOfferFn(kitty, buyer, expPrice, matron);

                        expectMarketEvent(
                            result, txType, buyer, kitty.kittyId
                        );
                    });

                    it('should REVERT if the value sent does not equal the selling price', async () => {
                        await truffleAssert.fails(
                            exeOfferFn(kitty, buyer, 0, matron),
                            truffleAssert.ErrorType.REVERT,
                            revertMsg.buyKitty.price // 'payment must be exact'
                        );
                    });

                    it('should REVERT if the order is not active', async () => {
                        await kittyMarketPlace.removeOffer(
                            kitty.kittyId, { from: kitty.owner });

                        await truffleAssert.fails(
                            exeOfferFn(kitty, buyer, expPrice, matron),
                            truffleAssert.ErrorType.REVERT,
                            revertMsg.buyKitty.notActive // "offer not active"
                        );
                    });
                });
            }

            describe('Buy Kitty', () => {

                it('should transfer the kitty to the buyer', async () => {
                    await setOffer(expPrice, kitty);
                    await buyKitty(kitty, buyer, expPrice);

                    const newOwner = await kittyContract.ownerOf(kitty.kittyId);
                    expect(newOwner).to.equal(buyer);
                });

                testExecuteOffer(setOffer, buyKitty, transTypes.buy);
            });

        });

        describe('Get all active offers', () => {
            let testOffers;
            async function createTestOffers() {
                testOffers = [
                    {
                        seller: accounts[1],
                        price: new BN('1000'),
                        index: new BN('0'),
                        tokenId: new BN('10'),
                        active: true
                    },
                    {
                        seller: accounts[2],
                        price: new BN('2000'),
                        index: new BN('1'),
                        tokenId: new BN('11'),
                        active: false
                    },
                    {
                        seller: accounts[2],
                        price: new BN('2000'),
                        index: new BN('2'),
                        tokenId: new BN('12'),
                        active: true
                    },
                    {
                        seller: accounts[2],
                        price: new BN('2000'),
                        index: new BN('3'),
                        tokenId: new BN('13'),
                        active: false
                    },
                ];
                for (let offer of testOffers) {
                    await kittyMarketPlace.test_createOffer(
                        offer.seller,
                        offer.price,
                        offer.tokenId,
                        offer.active
                    );
                }
            }

            async function expectOffers(expOffers, actualIds) {
                // the template implementation has "holes" with zero id's
                const activeIds = actualIds
                    .filter(id => id.toString(10) !== '0');

                expect(activeIds.length).to.equal(expOffers.length, 'incorrect number of results');

                const actualOffers = await Promise.all(
                    activeIds.map(id => kittyMarketPlace.getOffer(id)));

                expOffers.forEach(expOffer => {
                    const result = actualOffers.find(offer =>
                        offer.tokenId.toString(10) == expOffer.tokenId.toString(10));
                    expect(result).to.exist;
                });
            }

            it('should return all active sell offers', async () => {
                await createTestOffers();
                const expOffers = testOffers.filter(
                    offer => offer.active);

                const results = await kittyMarketPlace.getAllTokenOnSale();

                await expectOffers(expOffers, results);
            });

        });

    });
});

