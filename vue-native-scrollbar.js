/*----------------------------------------*\

    Vue Native Scrollbar

    TODO:

    * More Options
    * Option to disable parent scroll
      when reached bottom of scrollbar element
    * Option to disable scrollbar

    * Any performance improvements

    * Nested Scrollbar Elements
    * Horizontal Scrolling & Scrollbar

    * Custom classes compatibility
      with Vue scoped styles

    * Option for emitting Vue events
    * Option for programmatic scrollTo
    * Option for programmatic refresh
    * Option for touch drag dragger

    * Refresh on directive 'updated'
    * Refresh on directive 'componentUpdated'
    * Refresh on content & nested content change
    * Refresh on parent & child components change
    * Refresh on img inside content load
    * Refresh on page resize
    * Refresh on page orientationchange
    * Refresh on programmatic scroll

    * Fix user select on IE & Firefox

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
                    resizeDebounce: 100,
                    phantomScrollingClassDelay: 1000,
                    phantomDraggingClassDelay: 1000,
                },

                // binding + binding options
                binding: null,
                options: null,

                // references to native DOM elements
                el1: null,
                el2: null,
                dragger: null,

                // main properties that are computed on scroll and applied as DOM style
                visibleArea: 0,
                scrollTop: 0,
                barTop: 0,
                barHeight: 0,
                mouseBarOffsetY: 0,

                // helper properties
                barDragging: false,

                // timeouts for DOM class manipulation
                scrollingClassTimeout: null,
                draggingClassTimeout: null,
                phantomScrollingClassTimeout: null,
                phantomDraggingClassTimeout: null,

                // references to a functions we'll need when removing events
                barMousedown: null,
                documentMousemove: null,
                documentMouseup: null,
                //windowResize: null,
                scrollHandler: null,

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


            var relativeMouseY = (event.y - state.el1.getBoundingClientRect().top);
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

            dragger.className = (
                state.options && state.options.draggerClass ? state.options.draggerClass : 'vue-scrollbar-dragger'
            );


            if (state.options && state.options.disableStyles) {} else {
                dragger.style.position = 'absolute';
                dragger.style.right = 0;
                dragger.style.width = '10px';
                dragger.style.backgroundColor = 'rgba(55, 55, 55,.9)';
                dragger.style.transform = 'rotate3d(0,0,0,0)';
                dragger.style.backfaceVisibility = 'hidden';
            }

            state.el1.appendChild(dragger);
            return dragger;
        };


        var setupElementsStyles = function(el){
            var state = getState(el);

            // el1
            state.el1.style.position = 'relative';
            state.el1.style.overflow = 'hidden';

            // el2
            state.el2.style.overflowX = 'hidden';
            state.el2.style.overflowY = 'scroll';
            state.el2.style.height = '100%';
            state.el2.style.width = 'calc(100% + 18px)';

        };



        var updateDragger = function(el){
            var state = getState(el);


            // setting dragger styles (round up so there isn't any gaps)
            state.dragger.style.height = Math.ceil( state.barHeight ) + 'px';
            state.dragger.style.top = Math.ceil( state.barTop ) + 'px';


            // scrollbar enabled classs
            if (state.visibleArea<1) {
                addClass(state.dragger, 'mod-scrollbar-enabled');
                addClass(state.el1, 'mod-scrollbar-enabled');
            } else {
                removeClass(state.dragger, 'mod-scrollbar-enabled');
                removeClass(state.el1, 'mod-scrollbar-enabled');
            }



            // add scrolling class
            addClass(state.dragger, 'mod-scrolling');
            addClass(state.el1, 'mod-scrolling');

            // remove scrolling class
            state.scrollingClassTimeout ?
                clearTimeout(state.scrollingClassTimeout) : null;
            state.scrollingClassTimeout = setTimeout(function() {
                removeClass(state.dragger, 'mod-scrolling');
                removeClass(state.el1, 'mod-scrolling');
            }, state.config.scrollThrottle + 5);



            // add phantom scrolling class
            addClass(state.dragger, 'mod-scrolling-phantom');
            addClass(state.el1, 'mod-scrolling-phantom');

            // remove phantom scrolling class
            state.phantomScrollingClassTimeout ?
                clearTimeout(state.phantomScrollingClassTimeout) : null;
            state.phantomScrollingClassTimeout = setTimeout(function() {
                removeClass(state.dragger, 'mod-scrolling-phantom');
                removeClass(state.el1, 'mod-scrolling-phantom');
            }, state.config.scrollThrottle + state.config.phantomScrollingClassDelay);





        };



        var updateScroll = function(el){
            var state = getState(el);
            state.el2.scrollTop = state.scrollTop;
        };




        /*------------------------------------*\
            Refresh
        \*------------------------------------*/

        var refreshScrollbar = function(el){
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
                if (state.options && state.options.disableBodyUserSelect) {
                    document.body.style.userSelect = '';
                }

                // remove dragging class
                removeClass(state.dragger, 'mod-dragging');
                state.phantomDraggingClassTimeout = setTimeout(function() {
                    removeClass(state.dragger, 'mod-dragging-phantom');
                }, state.config.phantomDraggingClassDelay);


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
                if (state.options && state.options.disableBodyUserSelect) {
                    document.body.style.userSelect = 'none';
                }

                // add dragging class
                addClass(state.dragger, 'mod-dragging');
                state.phantomDraggingClassTimeout ?
                    clearTimeout(state.phantomDraggingClassTimeout) : null;
                addClass(state.dragger, 'mod-dragging-phantom');


                // add events
                document.addEventListener('mousemove', state.documentMousemove, 0);
                document.addEventListener('mouseup', state.documentMouseup, 0);


            }.bind(this);
        };



        //var windowResize = function(el){
        //    var state = getState(el);
        //    return debounce(function(event){
        //        // do stuff
        //    }.bind(this), state.config.resizeDebounce)
        //};







        /*------------------------------------*\
            Logic
        \*------------------------------------*/


        var initScrollbar = function(el, binding){

            // validate on directive bind if the markup is OK
            if (!markupValidation.call(this, el)){return false;}

            // create state
            var state = createState(el);

            // setup scrollbar "state"
            state.binding = binding;
            state.options = binding.value;
            state.el1 = el;
            state.el2 = el.firstChild;
            state.dragger = createDragger(el);

            state.scrollHandler = scrollHandler(el);

            state.barMousedown = barMousedown(el);
            state.documentMousemove = documentMousemove(el);
            state.documentMouseup = documentMouseup(el);
            //state.windowResize = windowResize(el);

            // initializations
            setupElementsStyles(el);

            // add events
            state.el2.addEventListener('scroll', state.scrollHandler, 0);
            state.dragger.addEventListener('mousedown', state.barMousedown, 0);
            //window.addEventListener('resize', state.windowResize, 0);

            // refresh
            refreshScrollbar(el);

        };


        var destroyScrollbar = function(el){

            // clear events
            //window.removeEventListener('resize', state.windowResize, 0);
            state.dragger.removeEventListener('mousedown', state.barMousedown, 0);
            state.el2.removeEventListener('scroll', state.scrollHandler, 0);

            // clear dragger
            state.dragger.remove();

            // clear timeouts
            state.draggingDelayedClassTimeout ?
                clearTimeout(state.draggingDelayedClassTimeout) : null;
            state.scrollingDelayedClassTimeout ?
                clearTimeout(state.draggingDelayedClassTimeout) : null;

            // cleanup of properties ( just to make sure (tm) )
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
                refreshScrollbar.call(this, el, binding);
            },

            componentUpdated: function(el, binding, vnode, oldVnode){
                refreshScrollbar.call(this, el, binding);
            },

            unbind: function(el, binding, vnode, oldVnode){
                destroyScrollbar.call(this, el, binding);
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
