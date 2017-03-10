;(function(){
    'use strict'




    /*----------------------------------------*\

        HELPERS

    \*----------------------------------------*/




    /*------------------------------------*\
        debounce
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
        throttle
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
        classes
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




    /*----------------------------------------*\

        VueScrollbar

        TODO:

        * Any performance improvements

        * Reduce wrapper elements from 3 to 2 (it's possible)
        * Don't use "width: calc( 100% + 18px )", use only "right: -18px"

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

        * Refresh on directive 'updated'
          and 'componentUpdated' hooks
        * Refresh on content change
        * Refresh on img inside content load
        * Refresh on page resize
        * Refresh on page orientationchange
        * Refresh on programmatic scroll

    \*----------------------------------------*/




    var VueScrollbar = {};
    VueScrollbar.install = function(Vue, options){




        /*------------------------------------*\
            Configuration
        \*------------------------------------*/
        var scrollThrottle = 10;
        var resizeDebounce = 100;
        var mousemoveThrottle = 1; // anything >1 makes dragger flicker
        var indicatorDebounce = 500;
        var scrollingDelayedClassTime = 1000;
        var draggingDelayedClassTime = 1000;




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
            if (!el.firstChild.firstChild) {
                Vue.util.warn('(Vue-Scrollbar) Element 2 doesn\'t have required child element 3.');
                return false;
            }
            if (el.firstChild.childElementCount > 1) {
                Vue.util.warn('(Vue-Scrollbar) Element 2 can have only one root element. It has ' + el.firstChild.childElementCount + '.');
                return false;
            }
            return true;
        };




        /*------------------------------------*\
            Computing Properties
        \*------------------------------------*/
        var setScrollHeightRatio = function(binding){
            var el3 = binding._scrollbar.el3;
            binding._scrollbar.heightRatio = (el3.clientHeight / el3.scrollHeight);
        };

        var setScrollbarTop = function(binding){
            var el3 = binding._scrollbar.el3;
            binding._scrollbar.barTop = String((el3.scrollTop / el3.scrollHeight) * 100) + '%';
        };

        var setScrollbarHeight = function(binding){
            if (binding._scrollbar.heightRatio >= 1) {
                binding._scrollbar.barHeight = 0 + '%';
            } else {
                binding._scrollbar.barHeight = String(binding._scrollbar.heightRatio * 100) + '%';
            }
        };

        var setScrollbarEnabled = function(binding){
            binding._scrollbar.barEnabled = (binding._scrollbar.heightRatio>=1) ? false : true;
        };




        /*------------------------------------*\
            Styles & DOM
        \*------------------------------------*/
        var createDragger = function(binding, el2){
            var dragger = document.createElement('div');

            dragger.className = (
                binding.value && binding.value.draggerClass ? binding.value.draggerClass : 'vue-scrollbar-dragger'
            );


            if (binding.value && binding.value.disableStyles) {} else {
                dragger.style.position = 'absolute';
                dragger.style.right = 0;
                dragger.style.width = '10px';
                dragger.style.backgroundColor = 'rgba(0,0,0,.5)';
                dragger.style.borderRadius = '20px';
                dragger.style.transform = 'rotate3d(0,0,0,0)';
                dragger.style.backfaceVisibility = 'hidden';
            }

            el2.appendChild(dragger);
            return dragger;
        };


        var setupElementsStyles = function(binding){

            var el1 = binding._scrollbar.el1;
            var el2 = binding._scrollbar.el2;
            var el3 = binding._scrollbar.el3;

            // el1
            el1.style.height = '100%';
            el1.style.position = 'relative';
            el1.style.overflow = 'hidden';
            el1.style.top = '0px';
            el1.style.left = '0px';

            // el2
            el2.style.position = 'static';
            el2.style.overflow = 'hidden';
            el2.style.height = '100%';
            el2.style.width = 'calc(100% + 18px)';

            // el3
            el3.style.position = 'relative';
            el3.style.overflowY = 'auto';
            el3.style.overflowX = 'hidden';
            el3.style.height = '100%';
            el3.style.width = 'auto';

        };


        var setupEl2Width = function(binding){
            binding._scrollbar.el2.style.width = binding._scrollbar.barEnabled ? 'calc(100% + 18px)' : 'auto';
        };



        var updateDraggerStyles = function(binding){

            // computations
            binding._scrollbar.dragger.style.height = binding._scrollbar.barHeight;
            binding._scrollbar.dragger.style.top = binding._scrollbar.barTop;

            // DOM 'scrolling' class
            addClass(binding._scrollbar.dragger, 'mod-scrolling');
            addClass(binding._scrollbar.el1, 'mod-scrolling');

            binding._scrollbar.scrollingClassTimeout ?
                clearTimeout(binding._scrollbar.scrollingClassTimeout) : null;

            binding._scrollbar.scrollingClassTimeout = setTimeout(function() {
                removeClass(binding._scrollbar.dragger, 'mod-scrolling');
                removeClass(binding._scrollbar.el1, 'mod-scrolling');
            }, scrollThrottle + 5);

            // DOM 'scrolling delayed' class
            addClass(binding._scrollbar.dragger, 'mod-scrolling-delayed');
            addClass(binding._scrollbar.el1, 'mod-scrolling-delayed');

            binding._scrollbar.scrollingDelayedClassTimeout ?
                clearTimeout(binding._scrollbar.scrollingDelayedClassTimeout) : null;

            binding._scrollbar.scrollingDelayedClassTimeout = setTimeout(function() {
                removeClass(binding._scrollbar.dragger, 'mod-scrolling-delayed');
                removeClass(binding._scrollbar.el1, 'mod-scrolling-delayed');
            }, scrollThrottle + scrollingDelayedClassTime);

            // DOM scrollbar enabled class
            if (binding._scrollbar.barEnabled) {
                addClass(binding._scrollbar.dragger, 'mod-scrollbar-enabled');
                addClass(binding._scrollbar.el1, 'mod-scrollbar-enabled');
            } else {
                removeClass(binding._scrollbar.dragger, 'mod-scrollbar-enabled');
                removeClass(binding._scrollbar.el1, 'mod-scrollbar-enabled');
            }

        };




        /*------------------------------------*\
            Refresh
        \*------------------------------------*/

        var refreshScrollbar = function(binding, el){
            var binding = el ? el._scrollbarBinding : binding;
            Vue.nextTick(function(){

                // first time with original width...
                setScrollHeightRatio.call(this, binding);
                setScrollbarEnabled.call(this, binding);
                setupEl2Width.call(this, binding);

                // second time with new width... it's hackish...
                setScrollHeightRatio.call(this, binding);
                setScrollbarEnabled.call(this, binding);
                setupEl2Width.call(this, binding);

                // other
                setScrollbarTop.call(this, binding);
                setScrollbarHeight.call(this, binding);
                updateDraggerStyles.call(this, binding);

            }.bind(this));
        };




        /*------------------------------------*\
            Events & Handlers
        \*------------------------------------*/
        var scrollHandler = function(){
            //if (!this._scrollbar.barEnabled) return false;
            var binding = this.parentElement.parentElement._scrollbarBinding;
            setScrollbarTop.call(this, binding);
            updateDraggerStyles.call(this, binding);
        };
        var throttledScrollHandler = throttle(scrollHandler, scrollThrottle);



        var windowResize = function(){
            return debounce(function(event){
                var binding = this;
            }.bind(this), resizeDebounce)
        };



        var documentMousemove = function(){
            return throttle(function(event){
                var binding = this;
                var delta = event.pageY - binding._scrollbar.barLastPageY;
                binding._scrollbar.barLastPageY = event.pageY;
                binding._scrollbar.el3.scrollTop += delta / binding._scrollbar.heightRatio;

                setScrollbarTop.call(this, binding);
                updateDraggerStyles.call(this, binding);

            }.bind(this), mousemoveThrottle);
        };


        var documentMouseup = function(){
            return function(event){
                var binding = this;
                binding._scrollbar.barDragging = false;

                if (binding.value && binding.value.disableBodyUserSelect) {
                    document.body.style.userSelect = '';
                } else {
                    binding._scrollbar.el1.style.userSelect = '';
                }

                removeClass(binding._scrollbar.dragger, 'mod-dragging');
                binding._scrollbar.draggingDelayedClassTimeout = setTimeout(function() {
                    removeClass(binding._scrollbar.dragger, 'mod-dragging-delayed');
                }, draggingDelayedClassTime);

                document.removeEventListener('mousemove', binding._scrollbar.documentMousemove, 0);
                document.removeEventListener('mouseup', binding._scrollbar.documentMouseup, 0);
            }.bind(this);

        };



        var barMousedown = function(){
            return function(event){
                var binding = this;
                binding._scrollbar.barDragging = true;
                binding._scrollbar.barLastPageY = event.pageY;

                if (binding.value && binding.value.disableBodyUserSelect) {
                    document.body.style.userSelect = 'none';
                } else {
                    binding._scrollbar.el1.style.userSelect = 'none';
                }

                addClass(binding._scrollbar.dragger, 'mod-dragging');

                binding._scrollbar.draggingDelayedClassTimeout ?
                    clearTimeout(binding._scrollbar.draggingDelayedClassTimeout) : null;

                addClass(binding._scrollbar.dragger, 'mod-dragging-delayed');

                document.addEventListener('mousemove', binding._scrollbar.documentMousemove, 0);
                document.addEventListener('mouseup', binding._scrollbar.documentMouseup, 0);
            }.bind(this);
        };




        /*------------------------------------*\
            Logic
        \*------------------------------------*/


        var initScrollbar = function(binding, el){

            // validate on directive bind if the markup is OK
            if (!markupValidation.call(this, el)){return false;}

            // get elements
            var el1 = el;
            var el2 = el1.firstChild;
            var el3 = el2.firstChild;

            // create dragger
            var dragger = createDragger.call(this, binding, el2);

            // scrollbar "state" -> vue docs say that directive "binding" property is read-only,
            // but it's easier & cleaner that way and I haven' encountered any bugs related to this
            // i only had to do some workarounds around hooks (el._scrollbarBinding)
            binding._scrollbar = {

                // references to native DOM elements
                el1: el1,
                el2: el2,
                el3: el3,
                dragger: dragger,

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
                barMousedown: barMousedown.call(binding),
                documentMousemove: documentMousemove.call(binding),
                documentMouseup: documentMouseup.call(binding),
                windowResize: windowResize.call(binding),

            };

            // workaround for hooks ('binding' gets resetted on all(?) hooks)
            el._scrollbarBinding = binding;

            // initializations
            setupElementsStyles.call(this, binding);
            binding._scrollbar.el3.addEventListener('scroll', throttledScrollHandler, 0);
            binding._scrollbar.dragger.addEventListener('mousedown', binding._scrollbar.barMousedown, 0);
            //window.addEventListener('resize', binding._scrollbar.windowResize, 0);
            refreshScrollbar.call(this, binding);

        };


        var destroyScrollbar = function(el){

            // access binding
            var binding = el._scrollbarBinding;

            // clear events
            //window.removeEventListener('resize', binding._scrollbar.windowResize, 0);
            binding._scrollbar.dragger.removeEventListener('mousedown', binding._scrollbar.barMousedown, 0);
            binding._scrollbar.el3.removeEventListener('scroll', throttledScrollHandler, 0);

            // clear dragger
            binding._scrollbar.dragger.remove();

            // clear timeouts
            binding._scrollbar.draggingDelayedClassTimeout ?
                clearTimeout(binding._scrollbar.draggingDelayedClassTimeout) : null;
            binding._scrollbar.scrollingDelayedClassTimeout ?
                clearTimeout(binding._scrollbar.draggingDelayedClassTimeout) : null;

            // cleanup of properties ( just to make sure (tm) )
            delete binding._scrollbar;
            delete el._scrollbarBinding;
        };




        /*------------------------------------*\
            Directive
        \*------------------------------------*/
        Vue.directive('scrollbar', {

            bind: function(el, binding, vnode, oldVnode){
                initScrollbar.call(this, binding, el);
            },

            //inserted: function(el, binding, vnode, oldVnode){},

            //update: function(el, binding, vnode, oldVnode){},

            componentUpdated: function(el, binding, vnode, oldVnode){
                refreshScrollbar.call(this, binding, el);
            },

            unbind: function(el, binding, vnode, oldVnode){
                destroyScrollbar.call(this, el);
            },

        });




    };





    /*------------------------------------*\
        Auto Install
    \*------------------------------------*/

    if (typeof Vue !== 'undefined') {
        Vue.use(VueScrollbar)
    }


    if(typeof exports === 'object' && typeof module === 'object') {
        module.exports = VueScrollbar
    } else if(typeof define === 'function' && define.amd) {
        define(function () { return VueScrollbar })
    } else if (typeof window !== 'undefined') {
        window.VueScrollbar = VueScrollbar
    }





})();
