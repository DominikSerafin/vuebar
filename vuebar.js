;(function(){
  'use strict';


  /*------------------------------------*\
    Vuebar Constructor
  \*------------------------------------*/
  function VB(Vue, el, binding, vnode, oldVnode){


    /*------------------------------------*\
      Warning
    \*------------------------------------*/
    this.warn = function(message){
      return Vue.util.warn(message);
      //return window.console.warn(message);
    }


    /*------------------------------------*\
      State
    \*------------------------------------*/
    this.state = {

      // config with default values that may be overwritten on directive intialization
      config: {
        scrollThrottle: 10,
        draggerThrottle: 10,
        resizeRefresh: true,
        observerThrottle: 100,
        resizeDebounce: 100,
        unselectableBody: true,
        overrideFloatingScrollbar: true,
        scrollingPhantomDelay: 1000,
        draggingPhantomDelay: 1000,
        preventParentScroll: false,

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

      // show dragger
      draggerEnabled: null,

      // properties computed for internal directive logic & DOM manipulations
      visibleArea: 0, // ratio between container height and scrollable content height
      scrollTop: 0, // position of content scrollTop in px
      barTop: 0, // position of dragger in px
      barHeight: 0, // height of dragger in px
      mouseBarOffsetY: 0, // relative position of mouse at the time of clicking on dragger
      barDragging: false, // when the dragger is used

      // reference to MutationObserver
      mutationObserver: null,

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



    /*------------------------------------*\
      Markup Validate
    \*------------------------------------*/
    this.validateMarkup = function(){
      if (!el.firstChild) {
        return this.warn('(Vuebar) Element 1 with v-bar directive doesn\'t have required child element 2.');
      }
      return true;
    }





    /*------------------------------------*\
      TODO:
      Initialize Scrollbar
    \*------------------------------------*/
    this.initializeScrollbar = function(){
      var state = this.state;

      // validate on directive bind if the markup is OK
      if (!this.validateMarkup()) { return }

      // safeguard to not initialize vuebar when it's already initialized
      if (el._vuebar) {
        // and I'm actually curious if that can happen by some bad miracle
        return this.warn('(Vuebar) Tried to initialize second time. If you see this please create an issue on https://github.com/DominikSerafin/vuebar with all relevent debug information. Thank you!');
      }

      // get options object
      // - it will come from directive binding (there is a 'value' property)
      // - or it will come from public method direct options object
      var options = binding.value ? binding.value : (binding ? binding : {});

      // overwrite defaults with provided options
      for (var key in options){
        this.state.config[key] = options[key];
      }

      // detect browser
      var browser = this.util.detectBrowser();


      // TODO EVERYRYTHIN BELOW!!!


      // dragger enabled?
      var elNativeScrollbarWidth = this.util.getNativeScrollbarWidth(el.firstElementChild);
      var overlayScrollbar = elNativeScrollbarWidth == 0;
      state.draggerEnabled = ( (!overlayScrollbar) || state.config.overrideFloatingScrollbar ) ? 1 : 0;

      // setup scrollbar "state"
      state.binding = binding.value ? binding : null;
      state.el1 = el;
      state.el2 = el.firstElementChild;
      state.dragger = this.createDragger();

      // create and reference event listeners
      state.barMousedown = this.barMousedown();
      state.documentMousemove = this.documentMousemove();
      state.documentMouseup = this.documentMouseup();
      state.windowResize = this.windowResize();
      state.scrollHandler = this.scrollHandler();
      state.wheelHandler = this.wheelHandler();

      // initialize and reference mutation observer
      state.mutationObserver = this.initMutationObserver();

      // el1 styles and class
      this.util.addClass(state.el1, state.config.el1Class);
      state.el1.style.position = 'relative';
      state.el1.style.overflow = 'hidden';

      // el2 styles and class
      this.util.addClass(state.el2, state.config.el2Class);
      state.el2.style.display = 'block';
      state.el2.style.overflowX = 'hidden';
      state.el2.style.overflowY = 'scroll';
      state.el2.style.height = '100%';

      // do the magic
      if (state.draggerEnabled) {

        // hide original browser overlay scrollbar and add padding to compensate for that
        if (overlayScrollbar) {
          /* state.el2.style.width = 'calc(100% + ' + 20 + 'px)';
          compatStyle(state.el2, 'BoxSizing', 'border-box'); */
          state.el2.style.width = '100%';
          this.util.compatStyle(state.el2, 'BoxSizing', 'content-box');
          state.el2.style.paddingRight = '20px';
        }

        // hide original browser scrollbar behind element edges and hidden overflow
        else {
          state.el2.style.width = 'calc(100% + ' + elNativeScrollbarWidth + 'px)';
        }

      }

      // add events
      // - wheel event is only needed when preventParentScroll option is enabled
      // - resize event is only needed when resizeRefresh option is enabled
      state.el2.addEventListener('scroll', state.scrollHandler, 0);
      state.dragger.addEventListener('mousedown', state.barMousedown, 0);
      state.config.preventParentScroll ? state.el2.addEventListener('wheel', state.wheelHandler, 0) : null;
      state.config.resizeRefresh ? window.addEventListener('resize', state.windowResize, 0) : null;

      // initial calculations using refresh scrollbar
      this.refreshScrollbar({immediate: true});


    }




    /*------------------------------------*\
      TODO:
      Refresh Scrollbar
    \*------------------------------------*/
    this.refreshScrollbar = function(options){
      var state = this.state;
      var options = options ? options : {};

      if (options.immediate) {
        this.computeVisibleArea();
        this.computeBarTop();
        this.computeBarHeight();
        this.updateDragger();
      }

      Vue.nextTick(function(){
        if (!el._vuebar) { return }
        this.computeVisibleArea();
        this.computeBarTop();
        this.computeBarHeight();
        this.updateDragger();
      }.bind(this));

    }






    /*------------------------------------*\
      TODO:
      Destroy Scrollbar
    \*------------------------------------*/
    this.destroy = function(options){
      var state = this.state;
      var options = options ? options : {};

      // clear events
      state.dragger.removeEventListener('mousedown', state.barMousedown, 0);
      state.el2.removeEventListener('scroll', state.scrollHandler, 0);
      state.el2.removeEventListener('wheel', state.scrollHandler, 0);
      window.removeEventListener('resize', state.windowResize, 0);

      // disconnect mutation observer
      state.mutationObserver ? state.mutationObserver.disconnect() : null;

      // clear el1 classes
      this.util.removeClass(state.el1, state.config.el1Class);
      this.util.removeClass(state.el1, state.config.el1ScrollVisibleClass);
      this.util.removeClass(state.el1, state.config.el1ScrollInvisibleClass);
      this.util.removeClass(state.el1, state.config.el1ScrollingClass);
      this.util.removeClass(state.el1, state.config.el1ScrollingPhantomClass);
      this.util.removeClass(state.el1, state.config.el1DraggingClass);

      // clear el1 styles
      if (options.clearStyles) {
        state.el1.style.position = '';
        state.el1.style.overflow = '';
      }

      // clear el2 classes
      this.util.removeClass(state.el2, state.config.el2Class);

      // clear el2 styles
      if (options.clearStyles) {
        state.el2.style.display = '';
        state.el2.style.overflowX = '';
        state.el2.style.overflowY = '';
        state.el2.style.msOverflowStyle = '';
        state.el2.style.height = '';
        state.el2.style.width = '';
      }

      // clear dragger
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
      Computing Properties
    \*------------------------------------*/
    this.computeVisibleArea = function(){
      var state = this.state;
      state.visibleArea = (state.el2.clientHeight / state.el2.scrollHeight);
    }

    this.computeScrollTop = function(){
      var state = this.state;
      state.scrollTop = state.barTop * (state.el2.scrollHeight / state.el2.clientHeight);
    }

    this.computeBarTop = function(event){
      var state = this.state;

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

    this.computeBarHeight = function(){
      var state = this.state;
      if (state.visibleArea >= 1) {
        state.barHeight = 0;
      } else {
        state.barHeight = state.el2.clientHeight * state.visibleArea;
      }
    }




    /*------------------------------------*\
      Styles & DOM
    \*------------------------------------*/
    this.createDragger = function(){
      var state = this.state;

      var dragger = document.createElement('div');
      var draggerStyler = document.createElement('div');

      dragger.className = state.config.draggerClass;

      dragger.style.position = 'absolute';

      if (!state.draggerEnabled) {
        dragger.style.display = 'none';
      }

      draggerStyler.className = state.config.draggerStylerClass;

      dragger.appendChild(draggerStyler);
      state.el1.appendChild(dragger);

      return dragger;
    }


    this.updateDragger = function(options){
      var state = this.state;
      var options = options ? options : {};

      // setting dragger styles
      state.dragger.style.height = parseInt( Math.round( state.barHeight)  ) + 'px';
      state.dragger.style.top = parseInt( Math.round( state.barTop ) ) + 'px';
      //state.dragger.style.height = Math.ceil( state.barHeight ) + 'px';
      //state.dragger.style.top = Math.ceil( state.barTop ) + 'px';

      // scrollbar visible / invisible classes
      if (state.draggerEnabled && (state.visibleArea<1)) {
        this.util.removeClass(state.el1, state.config.el1ScrollInvisibleClass);
        this.util.addClass(state.el1, state.config.el1ScrollVisibleClass);
      } else {
        this.util.removeClass(state.el1, state.config.el1ScrollVisibleClass);
        this.util.addClass(state.el1, state.config.el1ScrollInvisibleClass);
      }



      if (options.withScrollingClasses) {

        // add scrolling class
        this.util.addClass(state.el1, state.config.el1ScrollingClass);

        // remove scrolling class
        state.scrollingClassTimeout ?
        clearTimeout(state.scrollingClassTimeout) : null;
        state.scrollingClassTimeout = setTimeout(function() {
          this.util.removeClass(state.el1, state.config.el1ScrollingClass);
        }.bind(this), state.config.scrollThrottle + 5);



        // add phantom scrolling class
        this.util.addClass(state.el1, state.config.el1ScrollingPhantomClass);

        // remove phantom scrolling class
        state.scrollingPhantomClassTimeout ?
        clearTimeout(state.scrollingPhantomClassTimeout) : null;
        state.scrollingPhantomClassTimeout = setTimeout(function() {
          this.util.removeClass(state.el1, state.config.el1ScrollingPhantomClass);
        }.bind(this), state.config.scrollThrottle + state.config.scrollingPhantomDelay);

      }

    }




    this.preventParentScroll = function(event){
      var state = this.state;

      if (state.visibleArea >= 1) {
        return false;
      }

      var scrollDist = state.el2.scrollHeight - state.el2.clientHeight;
      var scrollTop = state.el2.scrollTop;

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



    this.updateScroll = function(){
      var state = this.state;
      state.el2.scrollTop = state.scrollTop;
    }







    /*------------------------------------*\
      Events & Handlers
    \*------------------------------------*/

    this.scrollHandler = function(){
      var state = this.state;
      return this.util.throttle(function(event){
        this.computeVisibleArea();
        this.computeBarHeight(); // fallback for an undetected content change
        if (!state.barDragging) {
          this.computeBarTop();
          this.updateDragger({withScrollingClasses: true});
        }
      }.bind(this), state.config.scrollThrottle);
    }


    this.wheelHandler = function(){
      var state = this.state;
      return function(event){
        this.preventParentScroll(event);
      }.bind(this);
    }


    this.documentMousemove = function(){
      var state = this.state;
      return this.util.throttle(function(event){
        this.computeBarTop(event);
        this.updateDragger();
        this.computeScrollTop();
        this.updateScroll();
      }.bind(this), state.config.draggerThrottle);
    }


    this.documentMouseup = function(){
      var state = this.state;
      return function(event){

        //
        state.barDragging = false;

        // enable user select
        state.el1.style.userSelect = '';
        state.config.unselectableBody ? this.util.compatStyle(document.body, 'UserSelect', '') : null;

        // remove dragging class
        this.util.removeClass(state.el1, state.config.el1DraggingClass);
        state.draggingPhantomClassTimeout = setTimeout(function() {
          this.util.removeClass(state.el1, state.config.el1DraggingPhantomClass);
        }.bind(this), state.config.draggingPhantomDelay);


        // remove events
        document.removeEventListener('mousemove', state.documentMousemove, 0);
        document.removeEventListener('mouseup', state.documentMouseup, 0);

      }.bind(this);

    }


    this.barMousedown = function(){
      var state = this.state;
      return function(event){

        // don't do nothing if it's not left mouse button
        if ( event.which!==1 ) { return false }

        state.barDragging = true;
        state.mouseBarOffsetY = event.offsetY;

        // disable user select
        state.el1.style.userSelect = 'none';
        state.config.unselectableBody ? this.util.compatStyle(document.body, 'UserSelect', 'none') : null;

        // add dragging class
        this.util.addClass(state.el1, state.config.el1DraggingClass);
        state.draggingPhantomClassTimeout ?
        clearTimeout(state.draggingPhantomClassTimeout) : null;
        this.util.addClass(state.el1, state.config.el1DraggingPhantomClass);

        // add events
        document.addEventListener('mousemove', state.documentMousemove, 0);
        document.addEventListener('mouseup', state.documentMouseup, 0);


      }.bind(this);
    }


    this.windowResize = function(){
      var state = this.state;
      return this.util.debounce(function(event){
        this.refreshScrollbar();
      }.bind(this), state.config.resizeDebounce);
    }




    this.initMutationObserver = function(){
      var state = this.state;
      if (typeof MutationObserver === typeof void 0) { return null }

      var observer = new MutationObserver(this.util.throttle(function(mutations) {
        this.refreshScrollbar();
      }.bind(this), state.config.observerThrottle));

      observer.observe(state.el2, {
        childList: true,
        characterData: true,
        subtree: true,
      });

      return observer;
    }

















    /*------------------------------------*\
      Utils
    \*------------------------------------*/
    this.util = {

      /*------------------------------------*\
        Debounce Helper
        https://remysharp.com/2010/07/21/throttling-function-calls
      \*------------------------------------*/
      debounce: function(fn, delay) {
        var timer = null;
        return function () {
          var context = this, args = arguments;
          clearTimeout(timer);
          timer = setTimeout(function () {
            fn.apply(context, args);
          }, delay);
        };
      },

      /*------------------------------------*\
        Throttle Helper
        https://remysharp.com/2010/07/21/throttling-function-calls
      \*------------------------------------*/
      throttle: function(fn, threshhold, scope) {
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
      },



      /*------------------------------------*\
        Style Vendor Prefixes Helper
      \*------------------------------------*/
      compatStyle: function(element, property, value) {
        element.style['webkit' + property] = value;
        element.style['moz' + property] = value;
        element.style['ms' + property] = value;
        element.style['o' + property] = value;
        element.style[ property.slice(0,1).toLowerCase() + property.substring(1) ] = value;
      },



      /*------------------------------------*\
        Class Manipulation Helpers
        https://plainjs.com/javascript/attributes/adding-removing-and-testing-for-classes-9/
      \*------------------------------------*/
      hasClass: function(el, className) {
        return el.classList ? el.classList.contains(className) : new RegExp('\\b'+ className+'\\b').test(el.className);
      },

      addClass: function(el, className) {
        if (el.classList) el.classList.add(className);
        else if (!hasClass(el, className)) el.className += ' ' + className;
      },

      removeClass: function(el, className) {
        if (el.classList) el.classList.remove(className);
        else el.className = el.className.replace(new RegExp('\\b'+ className+'\\b', 'g'), '');
      },





      /*------------------------------------*\
        Browser Detection Helper
      \*------------------------------------*/
      detectBrowser: function(){

        // get ie version helper
        function getIEVersion() {
          var match = window.navigator.userAgent.match(/(?:MSIE |Trident\/.*; rv:)(\d+)/);
          return match ? parseInt(match[1]) : void 0;
        }

        // user agent & vendor
        var ua = window.navigator.userAgent;
        var vendor = window.navigator.vendor;

        // chrome
        var chrome = (
          (ua.toLowerCase().indexOf('chrome') > -1) && (vendor.toLowerCase().indexOf('google') > -1)
        );

        // edge
        var edge = ua.indexOf('Edge') > -1;

        // safari
        var safari = !!window.safari || ((ua.toLowerCase().indexOf('safari') > -1) && (vendor.toLowerCase().indexOf('apple') > -1));

        // internet explorer
        var ie8 = getIEVersion() == 8;
        var ie9 = getIEVersion() == 9;
        var ie10 = getIEVersion() == 10;
        var ie11 = getIEVersion() == 11;
        var ie = ie8 || ie9 || ie10 || ie11;

        // is it mobile browser?
        // regex below thanks to http://detectmobilebrowsers.com/
        var uaOrVendor = ua || vendor || window.opera;
        var mobile = (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(uaOrVendor)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(uaOrVendor.substr(0,4)));

        // construct return object
        return {
          edge: edge,
          chrome: chrome,
          safari: safari,
          mobile: mobile,
          ie: ie,
          ie8: ie8,
          ie9: ie9,
          ie10: ie10,
          ie11: ie11,
        };

      },


      /*------------------------------------*\
        Calculate scrollbar width in element
        - if the width is 0 it means the scrollbar is floated/overlayed
        - accepts "container" paremeter because ie & edge can have different
        scrollbar behaviors for different elements using '-ms-overflow-style'
      \*------------------------------------*/
      getNativeScrollbarWidth: function(container) {
        var container = container ? container : document.body;

        var fullWidth = 0;
        var barWidth = 0;

        var wrapper = document.createElement('div');
        var child = document.createElement('div');

        wrapper.style.position = 'absolute';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.bottom = '0';
        wrapper.style.right = '0';
        wrapper.style.width = '100px';
        wrapper.style.overflow = 'hidden';

        wrapper.appendChild(child);
        container.appendChild(wrapper);

        fullWidth = child.offsetWidth;
        wrapper.style.overflowY = 'scroll';
        barWidth = fullWidth - child.offsetWidth;

        container.removeChild(wrapper);

        return barWidth;
      },


    }










  }






  /*------------------------------------*\
    Vuebar For Installation
  \*------------------------------------*/
  function Vuebar(Vue, options){

    /*------------------------------------*\
      Public Methods Install
    \*------------------------------------*/
    Vue.$_VB = VB;
    //Vue.prototype.$vuebar = VB;

    /*------------------------------------*\
      Directive Install
    \*------------------------------------*/
    Vue.directive('bar', {

      inserted: function(el, binding, vnode){
        (new VB(Vue, el, binding, vnode)).initializeScrollbar();
      },

      componentUpdated: function(el, binding, vnode, oldVnode){
        el._vuebar ? el._vuebar.refreshScrollbar() : null;
      },

      unbind: function(el, binding, vnode, oldVnode){
        // we shouldn't clearStyles because it actually doesn't matter that much
        // the element will be always deleted on unbind and its styles also
        // and if we do clear styles then it looks bad on transitions
        el._vuebar ? el._vuebar.destroyScrollbar({clearStyles: false}) : null;
      },

    });

  }

  /*------------------------------------*\
    Expose / Autoinstall
  \*------------------------------------*/
  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = Vuebar;
  } else if (typeof define === 'function' && define.amd) {
    define(function () { return Vuebar });
  } else if (typeof window !== typeof void 0) {
    window.Vuebar = Vuebar;
  }

  if (typeof Vue !== typeof void 0) {
    Vue.use(Vuebar);
  }

})();
