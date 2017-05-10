/*----------------------------------------*\

    Vue Native Scrollbar

    TODO:

    * Fix refresh sometimes not firing on child components update

    * Option to dynamically enable/disable scrollbar

    * Support for touch dragging dragger
    * Support for touch preventing parent scroll
    * Support for horizontal scrolling
    * Support for refresh on dynamic content (like img) load
    * Support for refresh on page orientationchange
    * Support for lass compatibility with component scoped stylesheets

\*----------------------------------------*/
;(function(){
    'use strict'


    /*------------------------------------*\
        Debounce Helper
        https://remysharp.com/2010/07/21/throttling-function-calls
    \*------------------------------------*/
    var debounce = function(fn, delay) {
        var timer = null;
        return function () {
            var context = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(context, args);
            }, delay);
        };
    };

    /*------------------------------------*\
        Throttle Helper
        https://remysharp.com/2010/07/21/throttling-function-calls
    \*------------------------------------*/
    var throttle = function(fn, threshhold, scope) {
        threshhold || (threshhold = 250);
        var last,
            deferTimer;
        return function () {
            var context = scope || this;

            var now = +new Date,
                args = arguments;
            if (last && now < last + threshhold) {
                // hold on to it
                clearTimeout(deferTimer);
                deferTimer = setTimeout(function () {
                    last = now;
                    fn.apply(context, args);
                }, threshhold);
            } else {
                last = now;
                fn.apply(context, args);
            }
        };
    };

    /*------------------------------------*\
        Class Manipulation Helper
        https://plainjs.com/javascript/attributes/adding-removing-and-testing-for-classes-9/
    \*------------------------------------*/
    var hasClass = function(el, className) {
        return el.classList ? el.classList.contains(className) : new RegExp('\\b'+ className+'\\b').test(el.className);
    }

    var addClass = function(el, className) {
        if (el.classList) el.classList.add(className);
        else if (!hasClass(el, className)) el.className += ' ' + className;
    }

    var removeClass = function(el, className) {
        if (el.classList) el.classList.remove(className);
        else el.className = el.className.replace(new RegExp('\\b'+ className+'\\b', 'g'), '');
    }


    /*------------------------------------*\
        Style Vendor Prefixes
    \*------------------------------------*/
    function compatStyle(element, property, value) {
        element.style["webkit" + property] = value;
        element.style["moz" + property] = value;
        element.style["ms" + property] = value;
        element.style["o" + property] = value;
        element.style[ property.slice(0,1).toLowerCase() + property.substring(1) ] = value;
    }









    /*------------------------------------*\
        Vue Native Scrollbar
    \*------------------------------------*/
    var VueScrollbar = {};
    VueScrollbar.install = function(Vue, options){



        /*------------------------------------*\
            Create State
        \*------------------------------------*/
        var createState = function(el){
            el._vueNativeScrollbarState = {

                // vue native scrollbar config
                config: {

                    scrollThrottle: 10,
                    mousemoveThrottle: 10,
                    resizeRefresh: true,
                    resizeDebounce: 100,
                    unselectableBody: true,
                    scrollingPhantomDelay: 1000,
                    draggingPhantomDelay: 1000,
                    preventParentScroll: false,

                    el1Class: 'vns',
                    el1ScrollEnabledClass: 'vns-enabled',
                    el1ScrollDisabledClass: 'vns-disabled',
                    el1ScrollingClass: 'vns-scrolling',
                    el1ScrollingPhantomClass: 'vns-scrolling-phantom',
                    el1DraggingClass: 'vns-dragging',
                    el1DraggingPhantomClass: 'vns-dragging-phantom',

                    draggerClass: 'vns-dragger',
                    draggerStylerClass: 'vns-dragger-styler',

                },

                // reference to binding
                binding: null,

                // references to directive DOM elements
                el1: null,
                el2: null,
                dragger: null,

                // properties computed for internal directive logic & DOM manipulations
                visibleArea: 0, // ratio between container height and scrollable content height
                scrollTop: 0, // position of content scrollTop in px
                barTop: 0, // position of dragger in px
                barHeight: 0, // height of dragger in px
                mouseBarOffsetY: 0, // relative position of mouse at the time of clicking on dragger
                barDragging: false, // when the dragger is used

                // references to timeouts for DOM class manipulation
                scrollingClassTimeout: null,
                draggingClassTimeout: null,
                scrollingPhantomClassTimeout: null,
                draggingPhantomClassTimeout: null,

                // references to a functions we'll need when removing events
                barMousedown: null,
                documentMousemove: null,
                documentMouseup: null,
                windowResize: null,
                scrollHandler: null,
                wheelHandler: null,

            }
            return el._vueNativeScrollbarState;
        };


        /*------------------------------------*\
            Get State
        \*------------------------------------*/
        var getState = function(el){
            return el._vueNativeScrollbarState;
        };










        /*------------------------------------*\
            Mount Validation
        \*------------------------------------*/
        var markupValidation = function(el){
            if (!el.firstChild) {
                Vue.util.warn('(Vue-Scrollbar) Element 1 with v-scrollbar directive doesn\'t have required child element 2.');
                return false;
            }
            if (el.childElementCount > 1) {
                Vue.util.warn('(Vue-Scrollbar) Element 1 with v-scrollbar directive can have only one root element. It has ' + el.childElementCount + '.');
                return false;
            }
            return true;
        };








        /*------------------------------------*\
            Computing Properties
        \*------------------------------------*/

        var computeVisibleArea = function(el){
            var state = getState(el);
            state.visibleArea = (state.el2.clientHeight / state.el2.scrollHeight);
        };

        var computeScrollTop = function(el){
            var state = getState(el);
            state.scrollTop = state.barTop * (state.el2.scrollHeight / state.el2.clientHeight);
        };

        var computeBarTop = function(el, event){
            var state = getState(el);

            // if the function gets called on scroll event
            if (!event) {
                state.barTop = state.el2.scrollTop * state.visibleArea;
                return false;
            } // else the function gets called when moving dragger with mouse


            var relativeMouseY = (event.clientY - state.el1.getBoundingClientRect().top);
            if (relativeMouseY <= state.mouseBarOffsetY) { // if bar is trying to go over top
                state.barTop = 0;
            }

            if (relativeMouseY > state.mouseBarOffsetY) { // if bar is moving between top and bottom
                state.barTop = relativeMouseY - state.mouseBarOffsetY;
            }


            if ( (state.barTop + state.barHeight ) >= state.el2.clientHeight ) { // if bar is trying to go over bottom
                state.barTop = state.el2.clientHeight - state.barHeight;
            }

        };

        var computeBarHeight = function(el){
            var state = getState(el);
            if (state.visibleArea >= 1) {
                state.barHeight = 0;
            } else {
                state.barHeight = state.el2.clientHeight * state.visibleArea;
            }
        };











        /*------------------------------------*\
            Styles & DOM
        \*------------------------------------*/
        var createDragger = function(el){
            var state = getState(el);

            var dragger = document.createElement('div');
            var draggerStyler = document.createElement('div');

            dragger.className = state.config.draggerClass;

            if (state.config.disableStyles) {} else {
                dragger.style.position = 'absolute';
                dragger.style.right = 0;
                dragger.style.width = '10px';
                dragger.style.transform = 'rotate3d(0,0,0,0)';
                dragger.style.backfaceVisibility = 'hidden';
            }


            draggerStyler.className = state.config.draggerStylerClass;

            draggerStyler.style.width = 'calc(100% - 2px)';
            draggerStyler.style.height = 'calc(100% - 4px)';
            draggerStyler.style.marginTop = '2px';
            draggerStyler.style.backgroundColor = 'rgba(55, 55, 55,.6)';


            dragger.appendChild(draggerStyler);
            state.el1.appendChild(dragger);

            return dragger;
        };



        var updateDragger = function(el){
            var state = getState(el);


            // setting dragger styles (round up so there isn't any gaps)
            state.dragger.style.height = Math.ceil( state.barHeight ) + 'px';
            state.dragger.style.top = Math.ceil( state.barTop ) + 'px';



            // scrollbar enabled /disabled classes
            if (state.visibleArea<1) {
                removeClass(state.el1, state.config.el1ScrollDisabledClass);
                addClass(state.el1, state.config.el1ScrollEnabledClass);
            } else {
                removeClass(state.el1, state.config.el1ScrollEnabledClass);
                addClass(state.el1, state.config.el1ScrollDisabledClass);
            }



            // add scrolling class
            addClass(state.el1, state.config.el1ScrollingClass);

            // remove scrolling class
            state.scrollingClassTimeout ?
                clearTimeout(state.scrollingClassTimeout) : null;
            state.scrollingClassTimeout = setTimeout(function() {
                removeClass(state.el1, state.config.el1ScrollingClass);
            }, state.config.scrollThrottle + 5);



            // add phantom scrolling class
            addClass(state.el1, state.config.el1ScrollingPhantomClass);

            // remove phantom scrolling class
            state.scrollingPhantomClassTimeout ?
                clearTimeout(state.scrollingPhantomClassTimeout) : null;
            state.scrollingPhantomClassTimeout = setTimeout(function() {
                removeClass(state.el1, state.config.el1ScrollingPhantomClass);
            }, state.config.scrollThrottle + state.config.scrollingPhantomDelay);





        };



        var preventParentScroll = function(el, event){
            var state = getState(el);

            var scrollDist = state.el2.scrollHeight - state.el2.clientHeight;
            var scrollTop = state.el2.scrollTop;
            var deltaY = event.deltaY;

            var wheelingUp = event.deltaY < 0;
            var wheelingDown = event.deltaY > 0;

            if ( (scrollTop <= 0) && wheelingUp) {
                event.preventDefault();
                return false;
            }

            if ( (scrollTop >= scrollDist) && wheelingDown) {
                event.preventDefault();
                return false;
            }

        };



        var updateScroll = function(el){
            var state = getState(el);
            state.el2.scrollTop = state.scrollTop;
        };















        /*------------------------------------*\
            Refresh
        \*------------------------------------*/

        var refreshScrollbar = function(el, onInitial){

            if (onInitial) {
                computeVisibleArea(el);
                computeBarTop(el);
                computeBarHeight(el);
                updateDragger(el);
            }

            Vue.nextTick(function(){

                computeVisibleArea(el);
                computeBarTop(el);
                computeBarHeight(el);
                updateDragger(el);

            }.bind(this));
        };



















        /*------------------------------------*\
            Events & Handlers
        \*------------------------------------*/

        var scrollHandler = function(el){
            var state = getState(el);
            return throttle(function(event){
                if (!state.barDragging) {
                    computeBarTop(el);
                    updateDragger(el);
                }
            }.bind(this), state.config.scrollThrottle);
        };


        var wheelHandler = function(el){
            var state = getState(el);
            return function(event){
                preventParentScroll(el, event);
            }.bind(this);
        };



        var documentMousemove = function(el){
            var state = getState(el);
            return throttle(function(event){
                computeBarTop(el, event);
                updateDragger(el);
                computeScrollTop(el);
                updateScroll(el);
            }.bind(this), state.config.mousemoveThrottle);
        };


        var documentMouseup = function(el){
            var state = getState(el);
            return function(event){

                //
                state.barDragging = false;

                // enable user select
                state.el1.style.userSelect = '';
                state.config.unselectableBody ? compatStyle(document.body, 'UserSelect', '') : null;

                // remove dragging class
                removeClass(state.el1, state.config.el1DraggingClass);
                state.draggingPhantomClassTimeout = setTimeout(function() {
                    removeClass(state.el1, state.config.el1DraggingPhantomClass);
                }, state.config.draggingPhantomDelay);


                // remove events
                document.removeEventListener('mousemove', state.documentMousemove, 0);
                document.removeEventListener('mouseup', state.documentMouseup, 0);

            }.bind(this);

        };



        var barMousedown = function(el){
            var state = getState(el);
            return function(event){

                state.barDragging = true;
                state.mouseBarOffsetY = event.layerY;

                // disable user select
                state.el1.style.userSelect = 'none';
                state.config.unselectableBody ? compatStyle(document.body, 'UserSelect', 'none') : null;

                // add dragging class
                addClass(state.el1, state.config.el1DraggingClass);
                state.draggingPhantomClassTimeout ?
                    clearTimeout(state.draggingPhantomClassTimeout) : null;
                addClass(state.el1, state.config.el1DraggingPhantomClass);

                // add events
                document.addEventListener('mousemove', state.documentMousemove, 0);
                document.addEventListener('mouseup', state.documentMouseup, 0);


            }.bind(this);
        };



        var windowResize = function(el){
            var state = getState(el);
            return debounce(function(event){
                refreshScrollbar(el);
            }.bind(this), state.config.resizeDebounce)
        };



















        /*------------------------------------*\
            Logic
        \*------------------------------------*/


        var initScrollbar = function(el, binding){

            // validate on directive bind if the markup is OK
            if (!markupValidation.call(this, el)){return false;}

            // create state
            var state = createState(el);

            // setup options
            var options = binding.value ? binding.value : {};
            for (var key in options){
                state.config[key] = options[key];
            };

            // setup scrollbar "state"
            state.binding = binding;
            state.el1 = el;
            state.el2 = el.firstChild;
            state.dragger = createDragger(el);

            // create and reference event listeners
            state.barMousedown = barMousedown(el);
            state.documentMousemove = documentMousemove(el);
            state.documentMouseup = documentMouseup(el);
            state.windowResize = windowResize(el);
            state.scrollHandler = scrollHandler(el);
            state.wheelHandler = wheelHandler(el);

            // el1 styles and class
            addClass(state.el1, state.config.el1Class);
            state.el1.style.position = 'relative';
            state.el1.style.overflow = 'hidden';

            // el2 styles
            state.el2.style.overflowX = 'hidden';
            state.el2.style.overflowY = 'scroll';
            state.el2.style.height = '100%';
            state.el2.style.width = 'calc(100% + 18px)';

            // add events
            // - wheel event is only needed when preventParentScroll option is enabled
            // - resize event is only needed when resizeRefresh option is enabled
            state.el2.addEventListener('scroll', state.scrollHandler, 0);
            state.dragger.addEventListener('mousedown', state.barMousedown, 0);
            state.config.preventParentScroll ? state.el2.addEventListener('wheel', state.wheelHandler, 0) : null;
            state.config.resizeRefresh ? window.addEventListener('resize', state.windowResize, 0) : null;

            // initial calculations using refresh scrollbar
            refreshScrollbar(el, 1);

        };












        var destroyScrollbar = function(el){

            // clear events
            state.dragger.removeEventListener('mousedown', state.barMousedown, 0);
            state.el2.removeEventListener('scroll', state.scrollHandler, 0);
            state.el2.removeEventListener('wheel', state.scrollHandler, 0);
            window.removeEventListener('resize', state.windowResize, 0);

            // clear elements
            state.dragger.removeChild(state.dragger.firstChild);
            state.el2.removeChild(state.dragger);

            // clear timeouts that may be still running
            state.scrollingPhantomClassTimeout ?
                clearTimeout(state.scrollingPhantomClassTimeout) : null;
            state.draggingPhantomClassTimeout ?
                clearTimeout(state.draggingPhantomClassTimeout) : null;

            // delete state object from element
            delete el._vueNativeScrollbarState;

        };




        /*------------------------------------*\
            Directive
        \*------------------------------------*/
        Vue.directive('scrollbar', {

            bind: function(el, binding, vnode, oldVnode){
                initScrollbar.call(this, el, binding);
            },

            //inserted: function(el, binding, vnode, oldVnode){},

            update: function(el, binding, vnode, oldVnode){
                refreshScrollbar.call(this, el, 0);
            },

            componentUpdated: function(el, binding, vnode, oldVnode){
                refreshScrollbar.call(this, el, 0);
            },

            unbind: function(el, binding, vnode, oldVnode){
                destroyScrollbar.call(this, el);
            },

        });



    };



    /*------------------------------------*\
        Auto Install
    \*------------------------------------*/
    if(typeof exports === 'object' && typeof module === 'object') {
        module.exports = VueScrollbar
    } else if(typeof define === 'function' && define.amd) {
        define(function () { return VueScrollbar })
    } else if (typeof window !== 'undefined') {
        window.VueScrollbar = VueScrollbar
    }

    if (typeof Vue !== 'undefined') {
        Vue.use(VueScrollbar)
    }



})();
