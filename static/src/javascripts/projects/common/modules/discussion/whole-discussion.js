define([
    'bean',
    'bonzo',
    'qwery',
    'Promise',
    'common/utils/$',
    'common/utils/_',
    'common/utils/ajax-promise'
], function (
    bean,
    bonzo,
    qwery,
    Promise,
    $,
    _,
    ajaxPromise
) {
    // This size effectively determines how many calls this module needs to make.
    // Number of ajax calls = number of comments / comments per page
    var commentsPerPage = 50;

    function WholeDiscussion(options) {
        this.discussionId = options.discussionId;
        this.discussion = [];
        this.params = {
            orderBy: options.orderBy,
            displayThreaded: options.displayThreaded,
            maxResponses: options.maxResponses
        };
    }

    WholeDiscussion.prototype.firstPageLoaded = function (resp) {
        // Add the first page of comments to the discussion object.
        this.storeCommentPage(resp, 1);

        // Keep the container so it can be easily reduced.
        this.discussionContainer = $('ul', bonzo.create(resp.commentsHtml)).empty();
        this.postedCommentHtml = resp.postedCommentHtml;
        this.lastPage = resp.lastPage;

        // Return a collection of the indices of the remaining pages.
        return _.range(2, this.lastPage + 1);
    };

    // Caches a bonzo object/array of comments, so that they can be re-assembled when the load is complete.
    WholeDiscussion.prototype.storeCommentPage = function (response, page) {
        var comments = $('li', bonzo.create(response.commentsHtml));
        if (this.params.orderBy === 'newest') {
            comments = comments.map(function (comment) {
                return comment;
            }).reverse();
        }
        this.discussion[page] = comments;
    };

    WholeDiscussion.prototype.loadPage = function (pageNumber) {

        // Always load in oldest order, to ensure pages are consistent whilst new comments are posted.
        var queryParams = {
            orderBy: 'oldest',
            page: pageNumber,
            pageSize: commentsPerPage,
            displayThreaded: this.params.displayThreaded
        };

        if (this.params.maxResponses) {
            queryParams.maxResponses = this.params.maxResponses;
        }

        return ajaxPromise({
            url: '/discussion/' + this.discussionId + '.json',
            type: 'json',
            method: 'get',
            crossOrigin: true,
            data: queryParams
        });
    };

    WholeDiscussion.prototype.loadRemainingPages = function (pages) {
        var pagePromises = pages.map(this.loadPage.bind(this));
        return Promise.all(pagePromises)
        .then(function (responses) {
            _.forEach(responses, function (response, index) {
                // The first page has been loaded, and pages are not zero-based, so adjust the index.
                this.storeCommentPage(response, index + 2);
            }.bind(this));
        }.bind(this));
    };

    WholeDiscussion.prototype.makeDiscussionResponseObject = function () {

        if (this.params.orderBy === 'newest') {
            this.discussion.reverse();
        }

        var comments = this.discussion.reduce(function (result, comments) {
            result.append(comments);
            return result;
        }, this.discussionContainer);

        return {
            paginationHtml: '',
            postedCommentHtml: this.postedCommentHtml,
            commentsHtml: comments.html(),
            lastPage: this.lastPage
        };
    };

    WholeDiscussion.prototype.loadAllComments = function () {

        // Always load the first page, to retrieve the number of comments in the discussion.
        return this.loadPage(1)
        .then(this.firstPageLoaded.bind(this))
        .then(this.loadRemainingPages.bind(this))
        .then(this.makeDiscussionResponseObject.bind(this));
    };

    return WholeDiscussion;
});
