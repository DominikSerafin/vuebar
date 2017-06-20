/*----------------------------------------*\
    Vuebar
\*----------------------------------------*/
;(function(){
    'use strict';




    /*------------------------------------*\
        Vuebar
    \*------------------------------------*/
    var VueBar = {};
    VueBar.install = function(Vue, options){




        /*------------------------------------*\
            Create State
        \*------------------------------------*/
        function createState(el){
            el._vuebarState = {

                // vuebar "state" + defaults
                config: {

                    scrollThrottle: 10,
                    draggerThrottle: 10,
                    resizeRefresh: true,
                    resizeDebounce: 100,
                    unselectableBody: true,
                    scrollingPhantomDelay: 1000,
                    draggingPhantomDelay: 1000,
                    preventParentScroll: false,
                    useScrollbarPseudo: false, // experimental

                    el1Class: 'vb',
                    el1ScrollVisibleClass: 'vb-visible',
                    el1ScrollInvisibleClass: 'vb-invisible',
                    el1ScrollingClass: 'vb-scrolling',
                    el1ScrollingPhantomClass: 'vb-scrolling-phantom',
                    el1DraggingClass: 'vb-dragging',
                    el1DraggingPhantomClass: 'vb-dragging-phantom',

                    el2Class: 'vb-content',

                    draggerClass: 'vb-dragger',
                    draggerStylerClass: 'vb-dragger-styler',

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

            };
            return el._vuebarState;
        }




        /*------------------------------------*\
            Get State
        \*------------------------------------*/
        function getState(el){
            return el._vuebarState;
        }




        /*------------------------------------*\
            Mount Validation
        \*------------------------------------*/
        function markupValidation(el){
            if (!el.firstChild) {
                Vue.util.warn('(Vuebar) Element 1 with v-bar directive doesn\'t have required child element 2.');
                return false;
            }
            return true;
        }




        /*------------------------------------*\
            Computing Properties
        \*------------------------------------*/
        function computeVisibleArea(el){
            var state = getState(el);
            state.visibleArea = (state.el2.clientHeight / state.el2.scrollHeight);
        }

        function computeScrollTop(el){
            var state = getState(el);
            state.scrollTop = state.barTop * (state.el2.scrollHeight / state.el2.clientHeight);
        }

        function computeBarTop(el, event){
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

        }

        function computeBarHeight(el){
            var state = getState(el);
            if (state.visibleArea >= 1) {
                state.barHeight = 0;
            } else {
                state.barHeight = state.el2.clientHeight * state.visibleArea;
            }
        }




        /*------------------------------------*\
            Styles & DOM
        \*------------------------------------*/
        function createDragger(el){
            var state = getState(el);

            var dragger = document.createElement('div');
            var draggerStyler = document.createElement('div');

            dragger.className = state.config.draggerClass;

            dragger.style.position = 'absolute';

            draggerStyler.className = state.config.draggerStylerClass;

            dragger.appendChild(draggerStyler);
            state.el1.appendChild(dragger);

            return dragger;
        }


        function updateDragger(el, options){
            var options = options ? options : {};
            var state = getState(el);

            // setting dragger styles
            state.dragger.style.height = parseInt( Math.round( state.barHeight)  ) + 'px';
            state.dragger.style.top = parseInt( Math.round( state.barTop ) ) + 'px';
            //state.dragger.style.height = Math.ceil( state.barHeight ) + 'px';
            //state.dragger.style.top = Math.ceil( state.barTop ) + 'px';

            // scrollbar visible / invisible classes
            if (state.visibleArea<1) {
                removeClass(state.el1, state.config.el1ScrollInvisibleClass);
                addClass(state.el1, state.config.el1ScrollVisibleClass);
            } else {
                removeClass(state.el1, state.config.el1ScrollVisibleClass);
                addClass(state.el1, state.config.el1ScrollInvisibleClass);
            }



            if (options.withScrollingClasses) {


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

            }

        }



        // this is an experimental feature
        // - it works only on chrome for now
        // - theoretically it should also work on safari but I don't have an environment to test it
        // - instead of hiding scrollbar by overflowing it with its parent set to overflow:hidden
        //   we hide scrollbar using pseudo-element selector ::-webkit-scrollbar
        function hideScrollbarUsingPseudoElement(el){
            var state = getState(el);
            var idName = 'vuebar-pseudo-element-styles';
            var selector = '.' + state.config.el2Class + '::-webkit-scrollbar';
            var styleElm = document.getElementById(idName);
            var sheet = null;

            if (styleElm) {
                sheet = styleElm.sheet;
            } else {
                styleElm = document.createElement('style');
                styleElm.id = idName;
                document.head.appendChild(styleElm);
                sheet = styleElm.sheet;
            }

            // detect if there is a rule already added to the selector
            var ruleExists = false;
            for(var i=0, l=sheet.rules.length; i<l; i++){
                var rule = sheet.rules[i];
                if (rule.selectorText == selector) {
                    ruleExists = true;
                }
            }

            // if there is rule added already then don't continue
            if (ruleExists) { return false };

            // insert rule for all browsers, except IE before version 9
            if (sheet.insertRule) {
                sheet.insertRule(selector + '{display:none}', 0);
            }

            // add rule for ie before version 9
            // - we dont need it because we're only targeting webkit
            // - to remove
            /*
            else if (sheet.addRule) {
                sheet.addRule('.' + state.config.el2Class + '::-webkit-scrollbar', 'display:none', 0);
            }
            */
        }




        function preventParentScroll(el, event){
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

        }



        function updateScroll(el){
            var state = getState(el);
            state.el2.scrollTop = state.scrollTop;
        }




        /*------------------------------------*\
            Refresh
        \*------------------------------------*/

        function refreshScrollbar(el, options){
            var options = options ? options : {};

            if (options.init) {
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
        }




        /*------------------------------------*\
            Events & Handlers
        \*------------------------------------*/

        function scrollHandler(el){
            var state = getState(el);
            return throttle(function(event){
                computeVisibleArea(el);
                computeBarHeight(el); // fallback for an undetected content change
                if (!state.barDragging) {
                    computeBarTop(el);
                    updateDragger(el, {withScrollingClasses: true});
                }
            }.bind(this), state.config.scrollThrottle);
        }


        function wheelHandler(el){
            var state = getState(el);
            return function(event){
                preventParentScroll(el, event);
            }.bind(this);
        }


        function documentMousemove(el){
            var state = getState(el);
            return throttle(function(event){
                computeBarTop(el, event);
                updateDragger(el);
                computeScrollTop(el);
                updateScroll(el);
            }.bind(this), state.config.draggerThrottle);
        }


        function documentMouseup(el){
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

        }


        function barMousedown(el){
            var state = getState(el);
            return function(event){

                // don't do nothing if it's not left mouse button
                if (event.which!==1){return false}

                state.barDragging = true;
                state.mouseBarOffsetY = event.offsetY;

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
        }


        function windowResize(el){
            var state = getState(el);
            return debounce(function(event){
                refreshScrollbar(el, {resize: true});
            }.bind(this), state.config.resizeDebounce);
        }




        /*------------------------------------*\
            Logic
        \*------------------------------------*/


        function initScrollbar(el, binding){

            // validate on directive bind if the markup is OK
            if (!markupValidation.call(this, el)){return false;}

            // create state
            var state = createState(el);

            // setup options
            var options = binding.value ? binding.value : {};
            for (var key in options){
                state.config[key] = options[key];
            }

            // detect browser
            var browser = detectBrowser();

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

            // el2 styles and class
            addClass(state.el2, state.config.el2Class);
            state.el2.style.overflowX = 'hidden';
            state.el2.style.overflowY = 'scroll';
            state.el2.style.msOverflowStyle = 'scrollbar';
            state.el2.style.height = '100%';

            if (state.config.useScrollbarPseudo && browser.chrome) {
                hideScrollbarUsingPseudoElement(el);
            } else {
                var widthPixels = browser.mobile ? 0 : ( browser.edge ? 12 : 17 );
                state.el2.style.width = 'calc(100% + ' + widthPixels + 'px)';
            }

            // add events
            // - wheel event is only needed when preventParentScroll option is enabled
            // - resize event is only needed when resizeRefresh option is enabled
            state.el2.addEventListener('scroll', state.scrollHandler, 0);
            state.dragger.addEventListener('mousedown', state.barMousedown, 0);
            state.config.preventParentScroll ? state.el2.addEventListener('wheel', state.wheelHandler, 0) : null;
            state.config.resizeRefresh ? window.addEventListener('resize', state.windowResize, 0) : null;

            // initial calculations using refresh scrollbar
            refreshScrollbar(el, {init: true});

        }




        function destroyScrollbar(el){
            var state = getState(el);

            // clear events
            state.dragger.removeEventListener('mousedown', state.barMousedown, 0);
            state.el2.removeEventListener('scroll', state.scrollHandler, 0);
            state.el2.removeEventListener('wheel', state.scrollHandler, 0);
            window.removeEventListener('resize', state.windowResize, 0);

            // clear elements
            state.dragger.removeChild(state.dragger.firstChild);
            state.el1.removeChild(state.dragger);

            // clear timeouts that may be still running
            state.scrollingPhantomClassTimeout ?
                clearTimeout(state.scrollingPhantomClassTimeout) : null;
            state.draggingPhantomClassTimeout ?
                clearTimeout(state.draggingPhantomClassTimeout) : null;

            // delete state object from element
            delete el._vuebarState;

        }




        /*------------------------------------*\
            Debounce Helper
            https://remysharp.com/2010/07/21/throttling-function-calls
        \*------------------------------------*/
        function debounce(fn, delay) {
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
        function throttle(fn, threshhold, scope) {
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
            }
        }




        /*------------------------------------*\
            Class Manipulation Helper
            https://plainjs.com/javascript/attributes/adding-removing-and-testing-for-classes-9/
        \*------------------------------------*/
        function hasClass(el, className) {
            return el.classList ? el.classList.contains(className) : new RegExp('\\b'+ className+'\\b').test(el.className);
        }

        function addClass(el, className) {
            if (el.classList) el.classList.add(className);
            else if (!hasClass(el, className)) el.className += ' ' + className;
        }

        function removeClass(el, className) {
            if (el.classList) el.classList.remove(className);
            else el.className = el.className.replace(new RegExp('\\b'+ className+'\\b', 'g'), '');
        }




        /*------------------------------------*\
            Style Vendor Prefixes Helper
        \*------------------------------------*/
        function compatStyle(element, property, value) {
            element.style["webkit" + property] = value;
            element.style["moz" + property] = value;
            element.style["ms" + property] = value;
            element.style["o" + property] = value;
            element.style[ property.slice(0,1).toLowerCase() + property.substring(1) ] = value;
        }




        /*------------------------------------*\
            Browser Detection Helper
        \*------------------------------------*/
        function detectBrowser(){

            var ua = window.navigator.userAgent;
            var vendor = window.navigator.vendor;
            var edge = ua.indexOf('Edge') > -1;
            var chrome = (
                (ua.toLowerCase().indexOf('chrome') > -1) && (vendor.toLowerCase().indexOf('google') > -1)
            );

            // regex below thanks to http://detectmobilebrowsers.com/
            var uaOrVendor = ua || vendor || window.opera;
            var mobile = (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(uaOrVendor)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(uaOrVendor.substr(0,4)));

            return {
                edge: edge,
                chrome: chrome,
                mobile: mobile,
            };

        }




        /*------------------------------------*\
            Directive Install
        \*------------------------------------*/
        Vue.directive('bar', {

            bind: function(el, binding, vnode, oldVnode){
                initScrollbar.call(this, el, binding);
            },

            //inserted: function(el, binding, vnode, oldVnode){},

            update: function(el, binding, vnode, oldVnode){
                refreshScrollbar.call(this, el, {update: true});
            },

            componentUpdated: function(el, binding, vnode, oldVnode){
                refreshScrollbar.call(this, el, {update: true});
            },

            unbind: function(el, binding, vnode, oldVnode){
                destroyScrollbar.call(this, el);
            },

        });



    };




    /*------------------------------------*\
        Autoinstall
    \*------------------------------------*/
    if(typeof exports === 'object' && typeof module === 'object') {
        module.exports = VueBar;
    } else if(typeof define === 'function' && define.amd) {
        define(function () { return VueBar });
    } else if (typeof window !== 'undefined') {
        window.VueBar = VueBar;
    }

    if (typeof Vue !== 'undefined') {
        Vue.use(VueBar);
    }




})();
