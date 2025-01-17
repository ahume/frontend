define([
    'bean',
    'bonzo',
    'qwery',
    'common/utils/_',
    'common/utils/$',
    'common/utils/config',
    'common/utils/detect',
    'common/utils/mediator',
    'common/utils/scroller',
    'common/utils/template',
    'common/utils/url',
    'common/modules/commercial/liveblog-adverts',
    'common/modules/experiments/affix',
    'common/modules/gallery/lightbox',
    'common/modules/live/filter',
    'common/modules/ui/autoupdate',
    'common/modules/ui/dropdowns',
    'common/modules/ui/notification-counter',
    'common/modules/ui/relativedates',
    'bootstraps/article',
    'common/modules/analytics/live-blog-metrics',
    'common/utils/robust'
], function (
    bean,
    bonzo,
    qwery,
    _,
    $,
    config,
    detect,
    mediator,
    scroller,
    template,
    url,
    liveblogAdverts,
    Affix,
    Lightbox,
    LiveFilter,
    AutoUpdate,
    dropdowns,
    NotificationCounter,
    RelativeDates,
    article,
    LiveBlogMetrics,
    robust
) {
    'use strict';

    var modules,
        affix = null,
        autoUpdate = null;

    function getTimelineEvents() {
        var keyEvents = qwery('.is-key-event').slice(0, 7),
            newestSummary = qwery('.is-summary')[0];

        $('.js-timeline-event').removeClass('js-timeline-event');

        if (newestSummary) {
            bonzo(newestSummary).addClass('js-timeline-event');
            if (keyEvents.length === 7) {
                keyEvents.pop();
            }
        }

        bonzo(keyEvents).addClass('js-timeline-event');

        return qwery('.js-timeline-event');
    }

    function createScrollTransitions() {

        var curBinding,
            timeline      = qwery('.timeline')[0],
            selectedClass = 'live-blog__key-event--selected';

        function unselect() {
            $('.' + selectedClass).removeClass(selectedClass);
        }

        function unselectOnScroll() {
            bean.off(curBinding);
            curBinding = mediator.once('window:scroll', function () { unselect(); });
        }

        bean.on(document.body, 'click', 'a', function (e) {
            var id = e.currentTarget.href.match(/.*(#.*)/);
            if (id && $(id[1]).hasClass('truncated-block')) {
                mediator.emit('module:liveblog:showkeyevents', true);
            }
        });

        if (timeline) {
            bean.on(timeline, 'click', '.timeline__link', function (e) {
                mediator.emit('module:liveblog:showkeyevents', true);
                $('.dropdown--live-feed').addClass('dropdown--active');
                var $el = bonzo(e.currentTarget),
                    eventId = $el.attr('data-event-id'),
                    title = $('.timeline__title', $el).text(),
                    targetEl = qwery('#' + eventId),
                    dim = bonzo(targetEl).offset();
                scroller.scrollTo(dim.top - 12, 500, 'easeOutQuint');
                window.setTimeout(unselectOnScroll, 550);
                bean.off(curBinding);
                unselect();
                $el.addClass(selectedClass);
                url.pushUrl({blockId: eventId}, title, window.location.pathname + '#' + eventId, true);
                e.stop();
            });
        }
    }

    function createKeyEventHTML(el) {
        var keyEventTemplate = '<li class="timeline__item" data-event-id="{{id}}">' +
                '<a class="timeline__link" href="#{{id}}" data-event-id="{{id}}">' +
                '<span class="timeline__date">{{time}}</span><span class="timeline__title u-underline">{{title}}</span></a></li>',
            data = {
                id: el.getAttribute('id'),
                title: $('.block-title', el).text(),
                time: $('.block-time__link', el).html()
            };

        return template(keyEventTemplate, data);
    }

    function getTimelineHTML(events) {
        var remaining;
        function recursiveRender(events, html) {
            if (events.length) { // key event at 0 index
                html += createKeyEventHTML(events[0]);
                remaining = events.slice(1);
            } else { // no events left
                return html;
            }
            return recursiveRender(remaining, html);
        }

        return recursiveRender(events, '');
    }

    function getUpdatePath() {
        var id,
            blocks = qwery('.js-liveblog-body .block'),
            newestBlock = null;

        if (autoUpdate.getManipulationType() === 'append') {
            newestBlock = blocks.pop();
        } else {
            newestBlock = blocks.shift();
        }

        // There may be no blocks at all. 'block-0' will return any new blocks found.
        id = newestBlock ? newestBlock.id : 'block-0';
        return window.location.pathname + '.json?lastUpdate=' + id;
    }

    modules = {

        initAdverts: function () {
            liveblogAdverts.init();
        },

        createFilter: function () {
            new LiveFilter($('.js-blog-blocks')[0]).ready();
            new NotificationCounter().init();
        },

        createTimeline: function () {
            var timelineHTML, dropdown, topMarker,
                allEvents = getTimelineEvents();
            if (allEvents.length > 0) {
                timelineHTML = getTimelineHTML(allEvents);

                $('.js-live-blog__timeline')
                    .empty()
                    .append(timelineHTML);
                dropdown = $('.js-live-blog__timeline-container .dropdown');
                dropdown.addClass('dropdown--active');
                dropdowns.updateAria(dropdown);

                if (detect.isBreakpoint({ min: 'desktop' }) && config.page.keywordIds.indexOf('football/football') < 0) {
                    topMarker = qwery('.js-top-marker')[0];
                    affix = new Affix({
                        element: qwery('.js-live-blog__timeline-container')[0],
                        topMarker: topMarker,
                        bottomMarker: qwery('.js-bottom-marker')[0],
                        containerElement: qwery('.js-live-blog__key-events')[0]
                    });
                }
                createScrollTransitions();
            }
        },

        handleUpdates: function () {
            mediator.on('modules:autoupdate:updates', function () {
                modules.createTimeline();
            });
        },

        createAutoUpdate: function () {

            if (config.page.isLive) {

                var timerDelay = detect.isBreakpoint({ min: 'desktop' }) ? 5000 : 60000;
                autoUpdate = new AutoUpdate({
                    path: getUpdatePath,
                    delay: timerDelay,
                    backoff: 2,
                    backoffMax: 1000 * 60 * 20,
                    attachTo: $('.js-liveblog-body')[0],
                    switches: config.switches,
                    manipulationType: 'prepend'
                });
                autoUpdate.init();
            }

            mediator.on('module:filter:toggle', function (orderedByOldest) {
                if (!autoUpdate) {
                    return;
                }
                if (orderedByOldest) {
                    autoUpdate.setManipulationType('append');
                } else {
                    autoUpdate.setManipulationType('prepend');
                }
            });
        },

        keepTimestampsCurrent: function () {
            var dates = RelativeDates;
            window.setInterval(
                function () {
                    dates.init();
                },
                60000
            );

        }
    };

    function ready() {
        robust('lb-adverts',    function () { modules.initAdverts(); });
        robust('lb-filter',     function () { modules.createFilter(); });
        robust('lb-timeline',   function () { modules.createTimeline(); });
        robust('lb-autoupdate', function () { modules.createAutoUpdate(); });
        robust('lb-timestamp',  function () { modules.keepTimestampsCurrent(); });
        robust('lb-updates',    function () { modules.handleUpdates(); });
        robust('lb-metrics',    function () { LiveBlogMetrics.init(); });

        // re-use modules from article bootstrap
        robust('lb-article',    function () { article.modules.initOpenCta(); });
        robust('lb-fence',      function () { article.modules.initFence(); });
        robust('lb-twitter',    function () { article.modules.initTruncateAndTwitter(); });
        robust('lb-sharing',    function () { article.modules.initSelectionSharing(); });
        robust('lb-lightbox',   function () { Lightbox.init(); });

        robust('lb-ready',   function () { mediator.emit('page:liveblog:ready'); });
    }

    return {
        init: ready
    };
});
