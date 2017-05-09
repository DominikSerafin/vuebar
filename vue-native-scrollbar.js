/*----------------------------------------*\

    Vue Native Scrollbar

    TODO:

    * Any performance improvements

    * [DONE!] Reduce wrapper elements from 3 to 2 (it's possible)
    * [KINDA DONE] Don't use "width: calc( 100% + 18px )", use only "right: -18px"

    * Mouse/Dragger better sync
    * Custom classes compatibility
      with Vue scoped styles
    * Dragger mousemove scrollTo bug
      where it flickers when there's
      a mousemoveThrottle applied

    * Option for emitting Vue events
    * Option for programmatic scrollTo
    * Option for programmatic refresh
    * Option for touch drag dragger

    * [DONE?] Refresh on directive 'updated'
      and 'componentUpdated' hooks
    * Refresh on content change
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
                    scrollThrottle: 10, // TODO
                    resizeDebounce: 100,
                    mousemoveThrottle: 1, // anything >1 makes dragger flicker
                    indicatorDebounce: 500, // TODO
                    scrollingDelayedClassTime: 1000,
                    draggingDelayedClassTime: 1000,
                },

                // binding + binding options
                binding: null,
                options: null,

                // references to native DOM elements
                el1: null,
                el2: null,
                dragger: null,

                // helper properties
                heightRatio: 0, // used for some calculations
                barLastPageY: 0, // used calcualting position of dragger on mousemove
                barEnabled: false, // info if the scrollbar is enabled at all ( content height < element height )
                barDragging: false, // info if the scrollbar is dragging (read-only, not used by this lib itself)

                // main properties that are computed on scroll and applied as DOM style
                barTop: '0%',
                barHeight: '10%',

                // timeouts for DOM class manipulation
                scrollingDelayedClassTimeout: null,
                draggingDelayedClassTimeout: null,

                // references to a functions we'll need when removing events
                barMousedown: null,
                documentMousemove: null,
                documentMouseup: null,
                windowResize: null,

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
        var setScrollHeightRatio = function(el){
            var state = getState(el);
            state.heightRatio = (state.el2.clientHeight / state.el2.scrollHeight);
        };

        var setScrollbarTop = function(el){
            var state = getState(el);
            state.barTop = String((state.el2.scrollTop / state.el2.scrollHeight) * 100) + '%';
        };

        var setScrollbarHeight = function(el){
            var state = getState(el);
            if (state.heightRatio >= 1) {
                state.barHeight = 0 + '%';
            } else {
                state.barHeight = String(state.heightRatio * 100) + '%';
            }
        };

        var setScrollbarEnabled = function(el){
            var state = getState(el);
            state.barEnabled = (state.heightRatio>=1) ? false : true;
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
                //dragger.style.borderRadius = '20px';
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



        var updateDraggerStyles = function(el){
            var state = getState(el);

            // computations
            state.dragger.style.height = state.barHeight;
            state.dragger.style.top = state.barTop;

            // DOM 'scrolling' class
            addClass(state.dragger, 'mod-scrolling');
            addClass(state.el1, 'mod-scrolling');

            state.scrollingClassTimeout ?
                clearTimeout(state.scrollingClassTimeout) : null;

            state.scrollingClassTimeout = setTimeout(function() {
                removeClass(state.dragger, 'mod-scrolling');
                removeClass(state.el1, 'mod-scrolling');
            }, state.config.scrollThrottle + 5);

            // DOM 'scrolling delayed' class
            addClass(state.dragger, 'mod-scrolling-delayed');
            addClass(state.el1, 'mod-scrolling-delayed');

            state.scrollingDelayedClassTimeout ?
                clearTimeout(state.scrollingDelayedClassTimeout) : null;

            state.scrollingDelayedClassTimeout = setTimeout(function() {
                removeClass(state.dragger, 'mod-scrolling-delayed');
                removeClass(state.el1, 'mod-scrolling-delayed');
            }, state.config.scrollThrottle + state.config.scrollingDelayedClassTime);

            // DOM scrollbar enabled class
            if (state.barEnabled) {
                addClass(state.dragger, 'mod-scrollbar-enabled');
                addClass(state.el1, 'mod-scrollbar-enabled');
            } else {
                removeClass(state.dragger, 'mod-scrollbar-enabled');
                removeClass(state.el1, 'mod-scrollbar-enabled');
            }

        };




        /*------------------------------------*\
            Refresh
        \*------------------------------------*/

        var refreshScrollbar = function(el){
            Vue.nextTick(function(){

                // first time with original width...
                setScrollHeightRatio(el);
                setScrollbarEnabled(el);

                // second time with new width... it's hackish...
                setScrollHeightRatio(el);
                setScrollbarEnabled(el);

                // other
                setScrollbarTop(el);
                setScrollbarHeight(el);
                updateDraggerStyles(el);

            }.bind(this));
        };




        /*------------------------------------*\
            Events & Handlers
        \*------------------------------------*/
        var scrollHandler = function(el){
            //if (!this._scrollbar.barEnabled) return false;
            var el = this.parentElement;
            setScrollbarTop(el);
            updateDraggerStyles(el);
        };
        var throttledScrollHandler = throttle(scrollHandler, 10);



        var windowResize = function(el){
            var state = getState(el);
            return debounce(function(event){
                var binding = this;
            }.bind(this), state.config.resizeDebounce)
        };



        var documentMousemove = function(el){
            var state = getState(el);

            return throttle(function(event){

                var delta = event.pageY - state.barLastPageY;
                state.barLastPageY = event.pageY;
                state.el2.scrollTop += delta / state.heightRatio;

                setScrollbarTop(el);
                updateDraggerStyles(el);

            }.bind(this), state.config.mousemoveThrottle);
        };


        var documentMouseup = function(el){
            return function(event){

                var state = getState(el);

                state.barDragging = false;

                if (state.options && state.options.disableBodyUserSelect) {
                    document.body.style.userSelect = '';
                } else {
                    state.el1.style.userSelect = '';
                }

                removeClass(state.dragger, 'mod-dragging');
                state.draggingDelayedClassTimeout = setTimeout(function() {
                    removeClass(state.dragger, 'mod-dragging-delayed');
                }, state.config.draggingDelayedClassTime);

                document.removeEventListener('mousemove', state.documentMousemove, 0);
                document.removeEventListener('mouseup', state.documentMouseup, 0);
            }.bind(this);

        };



        var barMousedown = function(el){
            return function(event){

                var state = getState(el);

                state.barDragging = true;
                state.barLastPageY = event.pageY;

                if (state.options && state.options.disableBodyUserSelect) {
                    document.body.style.userSelect = 'none';
                } else {
                    state.el1.style.userSelect = 'none';
                }

                addClass(state.dragger, 'mod-dragging');

                state.draggingDelayedClassTimeout ?
                    clearTimeout(state.draggingDelayedClassTimeout) : null;

                addClass(state.dragger, 'mod-dragging-delayed');

                document.addEventListener('mousemove', state.documentMousemove, 0);
                document.addEventListener('mouseup', state.documentMouseup, 0);
            }.bind(this);
        };




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
            state.barMousedown = barMousedown(el),
            state.documentMousemove = documentMousemove(el),
            state.documentMouseup = documentMouseup(el),
            state.windowResize = windowResize(el),

            // initializations
            setupElementsStyles(el);
            state.el2.addEventListener('scroll', throttledScrollHandler, 0);
            state.dragger.addEventListener('mousedown', state.barMousedown, 0);
            //window.addEventListener('resize', state.windowResize, 0);
            refreshScrollbar(el);

        };


        var destroyScrollbar = function(el){

            // access binding
            var binding = el._scrollbarBinding;

            // clear events
            //window.removeEventListener('resize', state.windowResize, 0);
            state.dragger.removeEventListener('mousedown', state.barMousedown, 0);
            state.el2.removeEventListener('scroll', throttledScrollHandler, 0);

            // clear dragger
            state.dragger.remove();

            // clear timeouts
            state.draggingDelayedClassTimeout ?
                clearTimeout(state.draggingDelayedClassTimeout) : null;
            state.scrollingDelayedClassTimeout ?
                clearTimeout(state.draggingDelayedClassTimeout) : null;

            // cleanup of properties ( just to make sure (tm) )
            delete binding._scrollbar;
            delete el._scrollbarBinding;
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
