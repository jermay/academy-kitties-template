const BN = web3.utils.BN
var expect = require('chai').expect;
const truffleAssert = require('truffle-assertions');

const TestKittyContract = artifacts.require("TestKittyContract");
const TestERC721Receiver = artifacts.require("TestERC721Receiver");
const TestBadNFTReceiver = artifacts.require("TestBadNFTReceiver");


contract.only('KittyContract', (accounts) => {

    const kittyStartingIndex = new BN('1');
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    let contractInstance;
    let contractOwner;
    let kittyOwner;
    let kitty;
    let newOwner;
    beforeEach(async () => {
        contractOwner = accounts[0];
        kittyOwner = accounts[1];
        newOwner = accounts[2];
        kitty = {
            kittyId: kittyStartingIndex,
            mumId: new BN('2'),
            dadId: new BN('3'),
            generation: new BN('4'),
            genes: new BN('1234567812345678'),
            cooldownIndex: new BN('2'),
            owner: kittyOwner,
        }
        contractInstance = await TestKittyContract.new();
    });

    function getEventFromResult(result, eventName) {
        let event = result.logs.find(log => log.event === eventName);
        return event.args;
    }

    /*
     * Wrapper functions
    */
    function addKitty(kitty) {
        return contractInstance.addKitty(
            kitty.mumId,
            kitty.dadId,
            kitty.generation,
            kitty.genes,
            kitty.owner,
        );
    }

    async function getKitty(id) {
        const result = await contractInstance.getKitty(id);
        const normalized = {
            kittyId: id,
            genes: result.genes,
            birthTime: result.birthTime,
            mumId: result.mumId,
            dadId: result.dadId,
            generation: result.generation
        }
        return normalized;
    }

    function compareBirthEvent(event, kitten) {
        return event.owner === kitten.owner
            && event.kittenId.toString(10) === kitten.kittyId.toString(10)
            && event.mumId.toString(10) === kitten.mumId.toString(10)
            && event.dadId.toString(10) === kitten.dadId.toString(10)
            && event.genes.toString(10) === kitten.genes.toString(10)
    }

    function addApproval(kitty, approved) {
        return contractInstance.approve(
            approved,
            kitty.kittyId,
            { from: kitty.owner }
        );
    }

    async function addKittyAndApproval(kitty, approved) {
        await addKitty(kitty);
        const result = await addApproval(kitty, approved);
        return result;
    }

    function addOperator(kitty, operator) {
        // grant operator approval
        return contractInstance.setApprovalForAll(
            operator, true, { from: kitty.owner });
    }

    async function addKittyAndOperator(kitty, operator) {
        await addKitty(kitty);
        return addOperator(kitty, operator);
    }

    async function addGen0Kitty(dna, _from = contractOwner) {
        return contractInstance.createKittyGen0(
            dna,
            { from: _from }
        );
    }

    async function createKitty(kitty) {
        return contractInstance.createKitty(
            kitty.mumId,
            kitty.dadId,
            kitty.generation,
            kitty.genes,
            kitty.owner
        );
    }

    function expectKitty(kitty, expected) {
        expect(kitty.mumId.toString(10)).to.equal(expected.mumId.toString(10));
        expect(kitty.dadId.toString(10)).to.equal(expected.dadId.toString(10));
        expect(kitty.genes.toString(10)).to.equal(expected.genes.toString(10));
        expect(kitty.generation.toString(10)).to.equal(expected.generation.toString(10));
    }

    function getGen0Count() {
        return contractInstance.gen0Counter();
    }

    function getGen0Limit() {
        return contractInstance.CREATION_LIMIT_GEN0();
    }

    function getKittiesOf(address) {
        return contractInstance.getKittyByOwner(address);
    }

    describe('init', () => {
        it('should be created with the un-kitty so valid kitties have an id > 0', async () => {
            const unKitty = {
                kittyId: new BN('0'),
                mumId: new BN('0'),
                dadId: new BN('0'),
                generation: new BN('0'),
                genes: new BN('115792089237316195423570985008687907853269984665640564039457584007913129639935'), // -1
                owner: zeroAddress,
            };
            result = await getKitty(0);

            expectKitty(result, unKitty);
        });
    });

    it('balanceOf should return the number of kitties held by an address', async () => {
        const expected = 2;
        await contractInstance.setOwnerKittyCount(kittyOwner, expected);

        const result = await contractInstance.balanceOf(kittyOwner);
        expect(result.toNumber()).to.equal(expected);
    });

    describe('ownerOf', () => {

        it('should return the owner of a kitty', async () => {
            await addKitty(kitty);

            const result = await contractInstance.ownerOf(kitty.kittyId);
            expect(result).to.equal(kittyOwner);
        });

        it('should REVERT if the kittyId does NOT exist', async () => {
            const idDoesNotExist = 123;
            await truffleAssert.fails(
                contractInstance.ownerOf(idDoesNotExist),
                truffleAssert.ErrorType.REVERT
            );
        });
    });

    it('name should return the contract name', async () => {
        const expected = "FilipKitties";
        const actual = await contractInstance.name();
        expect(actual).to.equal(expected);
    });

    it('symbol should return the contract symbol', async () => {
        const expected = "FK";
        const actual = await contractInstance.symbol();
        expect(actual).to.equal(expected);
    });

    describe('transfer', () => {

        beforeEach(async () => {
            await addKitty(kitty);
        });

        it('should change the ownership of the kitty to the new address', async () => {
            await contractInstance.transfer(newOwner, kitty.kittyId, { from: kittyOwner });

            let actualNewOwner = await contractInstance.ownerOf(kitty.kittyId);
            expect(actualNewOwner).to.equal(newOwner, 'owner');

            let oldOwnerCount = await contractInstance.balanceOf(kittyOwner);
            expect(oldOwnerCount.toString(10)).to.equal('0', 'old owner count');

            let newOwnerCount = await contractInstance.balanceOf(newOwner);
            expect(newOwnerCount.toString(10)).to.equal('1');
        });

        it('should emit a Transfer event', async () => {
            const result = await contractInstance.transfer(
                newOwner, kitty.kittyId, { from: kittyOwner });
            truffleAssert.eventEmitted(
                result, 'Transfer');

        });

        it('should REVERT if the sender does NOT own the kitty and is NOT approved', async () => {
            await truffleAssert.fails(
                contractInstance.transfer(newOwner, kitty.kittyId, { from: newOwner }),
                truffleAssert.ErrorType.REVERT
            );
        });

        it('should REVERT if the "to" address is zero', async () => {
            await truffleAssert.fails(
                contractInstance.transfer(zeroAddress, kitty.kittyId, { from: kittyOwner }),
                truffleAssert.ErrorType.REVERT
            );
        });

        it('should REVERT if the "to" address is the contract address', async () => {
            const contractAddress = contractInstance.address;
            await truffleAssert.fails(
                contractInstance.transfer(contractAddress, kitty.kittyId, { from: kittyOwner }),
                truffleAssert.ErrorType.REVERT
            );
        });
    });

    describe('approve', () => {
        let approvedAddr;
        beforeEach(async () => {
            await addKitty(kitty);
            approvedAddr = newOwner;
        });

        it('should set an approval for the given address', async () => {
            await contractInstance.approve(
                approvedAddr,
                kitty.kittyId,
                { from: kitty.owner }
            );

            const result = await contractInstance.getApproved(kitty.kittyId);
            expect(result.toString(10)).to.equal(approvedAddr);
        });

        it('should emit an Approval event', async () => {
            const result = await contractInstance.approve(
                approvedAddr,
                kitty.kittyId,
                { from: kitty.owner }
            );

            truffleAssert.eventEmitted(result, 'Approval');

            const event = result.logs[0].args;
            expect(event.owner).to.equal(kitty.owner);
            expect(event.approved).to.equal(approvedAddr);
            expect(event.tokenId.toString(10)).to.equal(kitty.kittyId.toString(10));
        });

        it('should REVERT if the sender is not the owner or approved', async () => {
            const bogusAddress = accounts[3];

            await truffleAssert.fails(
                contractInstance.approve(bogusAddress, kitty.kittyId, { from: bogusAddress }),
                truffleAssert.ErrorType.REVERT
            );
        });
    });

    describe('Get Approved', () => {
        let approved;
        beforeEach(() => {
            approved = accounts[2];
        });

        it('when set, it should return the approved address', async () => {
            await addKittyAndApproval(kitty, approved);

            const result = await contractInstance.getApproved(kitty.kittyId);
            expect(result).to.equal(approved);
        });

        it('should return the zero address when no approval has been set', async () => {
            // add kitty but don't set an approval
            await addKitty(kitty);

            const result = await contractInstance.getApproved(kitty.kittyId);
            expect(result).to.equal(zeroAddress);
        });

        it('should REVERT if tokenId is NOT valid', async () => {
            const invalidTokenId = 1234;

            await truffleAssert.fails(
                contractInstance.getApproved(invalidTokenId),
                truffleAssert.ErrorType.REVERT
            );
        });
    });

    describe('Operator approval for all', () => {

        it('should set and revoke operator approval for an address', async () => {
            // grant operator approval
            const operator = accounts[4];
            await contractInstance.setApprovalForAll(
                operator, true, { from: kittyOwner });

            const result = await contractInstance
                .isApprovedForAll(kittyOwner, operator);

            expect(result).to.equal(true);

            // revoke operator approval
            await contractInstance.setApprovalForAll(
                operator, false, { from: kittyOwner });

            const result2 = await contractInstance
                .isApprovedForAll(kittyOwner, operator);

            expect(result2).to.equal(false);
        });

        it('should support setting multiple operator approvals per address', async () => {
            // approve first operator
            const operator1 = accounts[4];
            await contractInstance.setApprovalForAll(
                operator1, true, { from: kittyOwner });

            const result = await contractInstance
                .isApprovedForAll(kittyOwner, operator1);

            expect(result).to.equal(true);

            // approve second operator
            const operator2 = accounts[5];
            await contractInstance.setApprovalForAll(
                operator2, true, { from: kittyOwner });

            const result2 = await contractInstance
                .isApprovedForAll(kittyOwner, operator1);

            expect(result2).to.equal(true);
        });

        it('should emit an ApprovalForAll event', async () => {
            const eventName = 'ApprovalForAll';
            const operator1 = accounts[4];
            const result = await contractInstance.setApprovalForAll(
                operator1, true, { from: kittyOwner });

            let event = getEventFromResult(result, eventName);
            truffleAssert.eventEmitted(result, eventName);
            expect(event.owner).to.equal(kittyOwner);
            expect(event.operator).to.equal(operator1);
            expect(event.approved).to.equal(true);
        });
    });

    describe('transferFrom', () => {
        beforeEach(async () => {
            await addKitty(kitty);
        });

        it('when the sender is the owner it should transfer ownership', async () => {
            await contractInstance.transferFrom(
                kitty.owner,
                newOwner,
                kitty.kittyId,
                { from: kitty.owner }
            );

            const result = await contractInstance.ownerOf(kitty.kittyId);
            expect(result).to.equal(newOwner);
        });

        it('when the sender is approved it should transfer ownership', async () => {
            const approved = accounts[2];
            await addApproval(kitty, approved);

            await truffleAssert.passes(
                contractInstance.transferFrom(
                    kitty.owner,
                    approved,
                    kitty.kittyId,
                    { from: approved }
                )
            );
        });

        it('when the sender is an approved operator it should transfer ownership', async () => {
            const operator1 = accounts[4];
            await contractInstance.setApprovalForAll(
                operator1, true, { from: kittyOwner });

            await truffleAssert.passes(
                contractInstance.transferFrom(
                    kitty.owner,
                    operator1,
                    kitty.kittyId,
                    { from: operator1 }
                )
            );
        });

        it('should REVERT when the sender is not the owner, approved, or an approved operator', async () => {
            const unapproved = accounts[3];

            await truffleAssert.reverts(
                contractInstance.transferFrom(
                    kitty.owner,
                    unapproved,
                    kitty.kittyId,
                    { from: unapproved }
                )
            );
        });

        it('should REVERT if from address is not the owner', async () => {
            await truffleAssert.reverts(
                contractInstance.transferFrom(
                    newOwner,
                    newOwner,
                    kitty.kittyId,
                    { from: kittyOwner }
                )
            );
        });

        it('should REVERT if to address is the zero address', async () => {
            await truffleAssert.reverts(
                contractInstance.transferFrom(
                    kitty.owner,
                    zeroAddress,
                    kitty.kittyId,
                    { from: kittyOwner }
                )
            );
        });

        it('should REVERT if tokenId is not valid', async () => {
            const invalidTokenId = 1234;
            await truffleAssert.reverts(
                contractInstance.transferFrom(
                    kitty.owner,
                    newOwner,
                    invalidTokenId,
                    { from: kittyOwner }
                )
            );
        });
    });

    describe('safeTransferFrom', () => {
        beforeEach(async () => {
            await addKitty(kitty);
        });

        it('should transfer ownership when the sender is the owner', async () => {
            await contractInstance.safeTransferFrom(
                kitty.owner,
                newOwner,
                kitty.kittyId,
                { from: kitty.owner }
            );

            const result = await contractInstance.ownerOf(kitty.kittyId);
            expect(result).to.equal(newOwner);
        });

        it('should transfer when the sender is NOT the owner but IS approved', async () => {
            let approved = accounts[3];
            await addApproval(kitty, approved);

            await contractInstance.safeTransferFrom(
                kitty.owner,
                approved,
                kitty.kittyId,
                { from: approved }
            );

            const result = await contractInstance.ownerOf(kitty.kittyId);
            expect(result).to.equal(approved);

        });

        it('should REVERT when the sender is NOT the owner and NOT approved', async () => {
            const unApproved = accounts[3];

            await truffleAssert.reverts(
                contractInstance.safeTransferFrom(
                    kitty.owner,
                    unApproved,
                    kitty.kittyId,
                    { from: unApproved }
                )
            );
        });

        it('should REVERT if the from address is not the owner', async () => {
            await truffleAssert.reverts(
                contractInstance.safeTransferFrom(
                    newOwner,
                    newOwner,
                    kitty.kittyId,
                    { from: kitty.owner }
                )
            );
        });

        it('should REVERT if the to address is the zero address', async () => {
            await truffleAssert.reverts(
                contractInstance.safeTransferFrom(
                    kitty.owner,
                    zeroAddress,
                    kitty.kittyId,
                    { from: kitty.owner }
                )
            );
        });

        it('should transfer the when the recieiver is an ERC721 contract', async () => {
            const erc721Receiver = await TestERC721Receiver.new();

            await contractInstance.safeTransferFrom(
                kitty.owner,
                erc721Receiver.address,
                kitty.kittyId,
                { from: kitty.owner }
            );
        });

        it('should REVERT when the reciever contract is NOT ERC721 compliant', async () => {
            const uncompliantContract = await TestBadNFTReceiver.new();

            await truffleAssert.reverts(
                contractInstance.safeTransferFrom(
                    kitty.owner,
                    uncompliantContract.address,
                    kitty.kittyId,
                    { from: kitty.owner }
                )
            );
        });
    });

    describe('supports interface', () => {
        const ERC165_ID = '0x01ffc9a7';
        const ERC721_ID = '0x80ac58cd';

        it('should return TRUE for ERC165', async () => {
            const result = await contractInstance.supportsInterface(ERC165_ID);

            expect(result).to.equal(true);
        });

        it('should return TRUE for ERC721', async () => {
            const result = await contractInstance.supportsInterface(ERC721_ID);

            expect(result).to.equal(true);
        });
    });


    describe('KittyFactory', () => {
        let testAccount;
        let dad, mum;
        beforeEach(async () => {
            testAccount = accounts[2];
            dad = {
                kittyId: kittyStartingIndex,
                mumId: new BN('0'),
                dadId: new BN('0'),
                generation: new BN('0'),
                genes: new BN('1112131415161718'),
                owner: kittyOwner,
            };
            mum = {
                kittyId: kittyStartingIndex.add(new BN('1')),
                mumId: new BN('0'),
                dadId: new BN('0'),
                generation: new BN('0'),
                genes: new BN('2122232425262728'),
                owner: kittyOwner,
            };
        });

        async function createParents() {
            await createKitty(dad);
            await createKitty(mum);
        }

        async function createGenXParents(parentGen = 0) {
            dad.generation = parentGen;
            mum.generation = parentGen;
            await createParents();
        }

        describe('Create Gen 0 Kitty', () => {
            let expKitty;
            let transaction;
            beforeEach(async () => {
                expKitty = {
                    kittyId: kittyStartingIndex,
                    mumId: new BN('0'),
                    dadId: new BN('0'),
                    generation: new BN('0'),
                    cooldownIndex: new BN('0'),
                    genes: new BN('1234567812345678'),
                    owner: contractOwner,
                }
                transaction = await addGen0Kitty(expKitty.genes);
            });

            it('should store the new kitty', async () => {
                result = await getKitty(expKitty.kittyId);
                expectKitty(result, expKitty);

                const actualOwner = await contractInstance.ownerOf(expKitty.kittyId);
                expect(actualOwner).to.equal(expKitty.owner);
            });

            it('should record the ownership of the new kitty', async () => {
                const kittyOwer = await contractInstance.ownerOf(expKitty.kittyId);
                expect(kittyOwer).to.equal(contractOwner);
            });

            it('should update the owner count', async () => {
                const result = await contractInstance.balanceOf(contractOwner);
                expect(result.toString(10)).to.equal('1');
            });

            it('should emit a Birth event', async () => {
                truffleAssert.eventEmitted(
                    transaction,
                    'Birth',
                    event => compareBirthEvent(event, expKitty)
                );
            });

            it('should update the gen 0 counter', async () => {
                const result = await getGen0Count();
                expect(result.toString(10)).to.equal('1');
            });

            it('should REVERT if gen 0 counter would exceed the gen 0 creation limit', async () => {
                // make more kitties than the limit
                const limit = await getGen0Limit();
                const makeKitties = async () => {
                    for (let i = 0; i <= limit; i++) {
                        await addGen0Kitty(expKitty.genes);
                    }
                }
                await truffleAssert.fails(
                    makeKitties(),
                    truffleAssert.ErrorType.REVERT
                );
            });

            it('should REVERT if the sender is NOT the owner', async () => {
                await truffleAssert.reverts(
                    addGen0Kitty(expKitty.genes, testAccount),
                    truffleAssert.ErrorType.REVERT,
                    "owner"
                )
            });
        });

        describe('Kittes of', () => {
            let testKitties;
            let exptectedIds;
            beforeEach(async () => {
                testKitties = [
                    {
                        kittyId: kittyStartingIndex,
                        mumId: new BN('0'),
                        dadId: new BN('0'),
                        generation: new BN('0'),
                        genes: new BN('1111111111111111'),
                        owner: contractOwner,
                    },
                    {
                        kittyId: kittyStartingIndex.add(new BN('1')),
                        mumId: new BN('0'),
                        dadId: new BN('0'),
                        generation: new BN('0'),
                        genes: new BN('2222222222222222'),
                        owner: testAccount,
                    },
                    {
                        kittyId: kittyStartingIndex.add(new BN('2')),
                        mumId: new BN('0'),
                        dadId: new BN('0'),
                        generation: new BN('0'),
                        genes: new BN('3333333333333333'),
                        owner: contractOwner,
                    },
                ]
                for (let kitty of testKitties) {
                    await createKitty(kitty);
                }
                exptectedIds = testKitties.filter(
                    kitty => kitty.owner === contractOwner)
                    .map(kitty => kitty.kittyId.toString(10));
            });

            it('should return all the kittyIds owned by the given address', async () => {
                results = await getKittiesOf(contractOwner);

                expect(results.length).to.equal(exptectedIds.length);
                results
                    .map(id => id.toString(10))
                    .forEach(id => expect(exptectedIds).to.contain(id));
            });

            it('should return an empty array if the owner has no kitties', async () => {
                result = await getKittiesOf(accounts[9]);

                expect(result.length).to.equal(0);
            });
        });

        describe.skip('Mix DNA', () => {
            let mumDna;
            let dadDna
            let masterSeed;
            const geneSizes = [2, 2, 2, 2, 1, 1, 2, 2, 1, 1];
            const randomDnaThreshold = 7;
            let expDna;
            beforeEach(() => {
                mumDna = '1122334456778890';
                dadDna = '9988776604332215';
                masterSeed = 1705; // % 1023 = 10 1010 1010 in binary
                // if the dnaSeed is 1 choose Dad gene, if 0 Mom gene
                // if the randomSeed digit is higher then the RANDOM_DNA_THRESHOLD
                // choose the random value instead of a parent gene
                // randomSeed:    8  3  8  2 3 5  4  3 9 8
                // randomValues: 62 77 47 79 1 3 48 49 2 8
                //                *     *              * *

                expDna = new BN('6222474406338828');
            });

            it('should mix the DNA according to the mask and seed', async () => {
                const result = await contractInstance.mixDna(dadDna, mumDna, masterSeed);

                expect(result.toString(10)).to.equal(expDna.toString(10));
            });
        });

        describe('breed', () => {
            let expKitty;
            beforeEach(async () => {
                expKitty = {
                    kittyId: new BN('3'),
                    mumId: new BN('2'),
                    dadId: new BN('1'),
                    generation: new BN('1'),
                    cooldownIndex: new BN('0'),
                    genes: new BN('1112131425262728'),
                    owner: kittyOwner,
                }
            });

            async function breedParents() {
                return contractInstance
                    .breed(dad.kittyId, mum.kittyId, { from: kittyOwner });
            }

            async function breedGenXParents(parentGen) {
                await createGenXParents(parentGen);
                return breedParents();
            }

            it('should create a new kitty assigned to the sender', async () => {
                await createParents();

                await contractInstance
                    .breed(dad.kittyId, mum.kittyId, { from: kittyOwner });

                const actualKitty = await getKitty(expKitty.kittyId);

                expectKitty(actualKitty, expKitty);

                const actualOwner = await contractInstance.ownerOf(expKitty.kittyId);
                expect(actualOwner).to.equal(expKitty.owner);
            });

            it('should emit a Birth event', async () => {
                await createParents();

                const result = await contractInstance
                    .breed(dad.kittyId, mum.kittyId, { from: kittyOwner });

                await truffleAssert.eventEmitted(
                    result,
                    'Birth',
                    event => event.owner === kittyOwner &&
                        event.mumId.toString(10) === mum.kittyId.toString(10) &&
                        event.dadId.toString(10) === dad.kittyId.toString(10)
                );
            })

            it('should REVERT if the sender does not own the dad kitty', async () => {
                dad.owner = accounts[3];
                await createParents();

                await truffleAssert.reverts(
                    contractInstance
                        .breed(dad.kittyId, mum.kittyId, { from: kittyOwner })
                );
            });

            it('should REVERT if the sender does not own the mum kitty', async () => {
                mum.owner = accounts[3];
                await createParents();

                await truffleAssert.reverts(
                    contractInstance
                        .breed(dad.kittyId, mum.kittyId, { from: kittyOwner })
                );
            });

            // how generation number is handled is likely to be different
            // in many cases
            // describe('kitten', () => {

            //     describe('generation number', () => {

            //         [
            //             { name: 'same gen', mumGen: 0, dadGen: 0, kittyGen: 1 },
            //             { name: 'mum younger', mumGen: 1, dadGen: 0, kittyGen: 1 },
            //             { name: 'dad younger', mumGen: 1, dadGen: 3, kittyGen: 2 },
            //         ].forEach(testCase => {
            //             it(`should be 1 + half of the higher generation parent. Case: ${testCase.name} mum gen: ${testCase.mumGen} dad gen: ${testCase.dadGen}`, async () => {
            //                 mum.generation = testCase.mumGen;
            //                 dad.generation = testCase.dadGen;
            //                 await createParents();

            //                 await contractInstance
            //                     .breed(dad.kittyId, mum.kittyId, { from: kittyOwner });

            //                 const actualKitty = await getKitty(expKitty.kittyId);
            //                 expect(actualKitty.generation.toString(10)).to.equal(testCase.kittyGen.toString());
            //             });
            //         });
            //     });
            // });

        });

    });

});