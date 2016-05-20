/**
 * Created by felix on 19.05.16.
 */
import { expect } from 'chai';
import proxyquire from 'proxyquire';
import sinon from 'sinon';
import _ from 'underscore';

require('../../../lib/helpers');

let MinutesCollection = {
    findOne: sinon.stub()
};

class MeteorError {}

let Meteor = {
    call: sinon.stub(),
    Error: MeteorError
};


let isCurrentUserModeratorStub = sinon.stub();
let updateLastMinutesDateStub = sinon.stub();
let MeetingSeries = function(seriesId) {
    this._id = seriesId;
    this.isCurrentUserModerator = isCurrentUserModeratorStub;
    this.updateLastMinutesDate = updateLastMinutesDateStub;
};
let Topic = {};

const {
    Minutes
    } = proxyquire('../../../imports/minutes', {
    'meteor/meteor': { Meteor, '@noCallThru': true},
    './collections/minutes_private': { MinutesCollection, '@noCallThru': true},
    './meetingseries': { MeetingSeries, '@noCallThru': true},
    './topic': { Topic, '@noCallThru': true},
    'meteor/underscore': { _, '@noCallThru': true}
});

describe('Minutes', function () {

    let minutesDoc, minute;

    beforeEach(function () {
        minutesDoc = {
            meetingSeries_id: 'AaBbCc01',
            _id: 'AaBbCc02',
            date: '2016-05-06',
            createdAt: new Date(),
            topics: [],
            isFinalized: false,
            isUnfinalized: true,
            participants: '',
            agenda: ''
        };

        minute = new Minutes(minutesDoc);
    });

    afterEach(function () {
        MinutesCollection.findOne.reset();
        Meteor.call.reset();
        isCurrentUserModeratorStub.reset();
        updateLastMinutesDateStub.reset();
    });

    describe('#constructor', function () {

        it('sets the properties correctly', function () {
            expect(JSON.stringify(minute)).to.equal(JSON.stringify(minutesDoc));
        });

        it('fetches the minute from the database if the id was given', function() {

            new Minutes(minutesDoc._id);
            expect(MinutesCollection.findOne.calledOnce, "findOne should be called once").to.be.true;
            expect(MinutesCollection.findOne.calledWith(minutesDoc._id), "findOne should be called with the id").to.be.true;
        });

        it('throws exception if constructor will be called without any arguments', function () {
            let exceptionThrown;
            try {
                new Minutes();
                exceptionThrown = false;
            } catch (e) {
                exceptionThrown = (e instanceof MeteorError);
            }

            expect(exceptionThrown).to.be.true;
        });

    });

    describe('#update', function () {

        let updateDocPart;

        beforeEach(function () {
            updateDocPart = {
                date: '2016-05-07'
            }
        });

        it('calls the meteor method minutes.update', function () {
            minute.update(updateDocPart);
            expect(Meteor.call.calledOnce).to.be.true;
        });

        it('sends the doc part and the minutes id to the meteor method minutes.update', function () {
            minute.update(updateDocPart);
            let sentObj = JSON.parse(JSON.stringify(updateDocPart));
            sentObj._id = minute._id;
            expect(Meteor.call.calledWithExactly('minutes.update', sentObj, undefined)).to.be.true;
        });

        it('updates the changed property of the minute object', function () {
            minute.update(updateDocPart);
            expect(minute.date).to.equal(updateDocPart.date);
        });

    });

    describe('#save', function () {

        it('calls the meteor method minutes.insert if a new minute will be saved', function () {
            delete minute._id;
            minute.save();
            expect(Meteor.call.calledOnce).to.be.true;
        });

        it('sends the minutes object to the meteor method minutes.insert', function () {
            delete minute._id;
            minute.save();
            expect(Meteor.call.calledWithExactly('minutes.insert', minute, undefined, undefined)).to.be.true;
        });

        it('sets the createdAt-property if it is not set', function () {
            delete minute._id;
            delete minute.createdAt;
            minute.save();
            expect(minute).to.have.ownProperty('createdAt');
        });

        it('calls the meteor method minutes.update if a existing minute will be saved', function () {
            minute.save();
            expect(Meteor.call.calledOnce).to.be.true;
        });

        it('sends the minutes object to the meteor method minutes.update', function () {
            minute.save();
            expect(Meteor.call.calledWithExactly('minutes.update', minute)).to.be.true;
        });

    });

    it('#parentMeetingSeries', function () {
        let parentSeries = minute.parentMeetingSeries();
        expect(parentSeries instanceof MeetingSeries, "result should be an instance of MeetingSeries").to.be.true;
        expect(parentSeries._id, "created meeting series object should have the correct series id").to.equal(minute.meetingSeries_id);
    });

    it('#parentMeetingSeriesID', function () {
        expect(minute.parentMeetingSeriesID()).to.equal(minute.meetingSeries_id);
    });

    describe('topic related methods', function () {

        let topic1, topic2, topic3, topic4;

        beforeEach(function () {
            topic1 = {
                _id: "01",
                subject: "firstTopic",
                isNew: true,
                isOpen: true
            };
            topic2 = {
                _id: "02",
                subject: "2ndTopic",
                isNew: true,
                isOpen: false
            };
            topic3 = {
                _id: "03",
                subject: "3rdTopic",
                isNew: false,
                isOpen: true
            };
            topic4 = {
                _id: "04",
                subject: "4thTopic",
                isNew: false,
                isOpen: false
            };
            minute.topics.push(topic1);
            minute.topics.push(topic2);
            minute.topics.push(topic3);
            minute.topics.push(topic4);
        });

        describe('#findTopic', function () {

            it('finds the correct topic identified by its id', function () {
                expect(minute.findTopic(topic1._id)).to.deep.equal(topic1);
            });

            it('returns undefined if topic was not found', function () {
                expect(minute.findTopic('unknownId')).to.be.undefined;
            });

        });

        describe('#removeTopic', function () {

            it('removes the topic from the topics array', function () {
                let oldLength = minute.topics.length;
                minute.removeTopic(topic1._id);
                expect(minute.topics).to.have.length(oldLength-1);
            });

            it('calls the meteor method minutes.update', function () {
                minute.removeTopic(topic1._id);
                expect(Meteor.call.calledOnce).to.be.true;
            });

        });

        describe('#getNewTopics', function () {

            it('returns the correct amount of topics', function () {
                expect(minute.getNewTopics()).to.have.length(2);
            });

            it('returns only new topics', function () {
                let newTopics = minute.getNewTopics();
                newTopics.forEach(topic => {
                    expect(topic.isNew, "isNew-flag should be set").to.be.true;
                });
            });

        });

        describe('#getOldClosedTopics', function () {

            it('returns the correct amount of topics', function () {
                expect(minute.getOldClosedTopics()).to.have.length(1);
            });

            it('returns only old and closed topics', function () {
                let oldClosedTopics = minute.getOldClosedTopics();
                oldClosedTopics.forEach(topic => {
                    expect(
                        topic.isNew && topic.isOpen,
                        "isNew and isOpen flag should both not set"
                    ).to.be.false;
                });
            });

        });

    });

    describe('#upsertTopic', function () {

        let topicDoc;

        beforeEach(function () {
            topicDoc = {
                subject: "myTopic"
            }
        });

        it('adds a new topic to the topic array', function () {
            let oldLength = minute.topics.length;
            minute.upsertTopic(topicDoc);
            expect(minute.topics).to.have.length(oldLength+1);
        });

        it('generates a id for a brand new topic', function() {
            minute.upsertTopic(topicDoc);
            expect(minute.topics[0]._id).to.not.be.empty;
        });

        it('adds a new topic which already has a id', function () {
            topicDoc._id = "myId";
            minute.upsertTopic(topicDoc);
            expect(minute.topics, "size of the topic array should be increased by one").to.have.length(1);
            expect(minute.topics[0]._id, "the id should not have changed").to.equal(topicDoc._id);
        });

        it('updates an existing topic correctly', function () {
            topicDoc._id = "myId";
            minute.upsertTopic(topicDoc);
            topicDoc.subject = "changedSubject";
            minute.upsertTopic(topicDoc);
            expect(minute.topics, "update an existing topic should not change the size of the topics array").to.have.length(1);
            expect(minute.topics[0].subject, "the subject should have been updated").to.equal(topicDoc.subject);
        });

        it('calls the meteor method minutes.update', function () {
            minute.upsertTopic(topicDoc);
            expect(Meteor.call.calledOnce).to.be.true;
        });

        it('sends the doc part and the minutes id to the meteor method minutes.update', function () {
            minute.upsertTopic(topicDoc);
            let callArgs = Meteor.call.getCall(0).args;
            expect(callArgs[0], "first argument should be the name of the meteor method", 'minutes.update');
            let sentDoc = callArgs[1];
            expect(sentDoc._id, 'minutes id should be part of the document').to.equal(minutesDoc._id);
            expect(sentDoc, 'topics should be a part of the document').to.have.ownProperty('topics');
        });

    });

    describe('#finalize', function () {

        it('calls the meteor method minutes.finalize', function() {
            minute.finalize();

            expect(Meteor.call.calledOnce).to.be.true;
        });

        it('sends the id to the meteor method minutes.finalize', function () {
            minute.finalize();

            expect(Meteor.call.calledWithExactly('minutes.finalize', minutesDoc._id, undefined)).to.be.true;
        });

    });

    describe('#unfinalize', function () {

        it('calls the meteor method minutes.unfinalize', function() {
            minute.unfinalize();

            expect(Meteor.call.calledOnce).to.be.true;
        });

        it('sends the id to the meteor method minutes.unfinalize', function () {
            minute.unfinalize();

            expect(Meteor.call.calledWithExactly('minutes.unfinalize', minutesDoc._id, undefined)).to.be.true;
        });

    });

    it('#isCurrentUserModerator', function () {
        minute.isCurrentUserModerator();

        expect(isCurrentUserModeratorStub.calledOnce).to.be.true;
    });

});