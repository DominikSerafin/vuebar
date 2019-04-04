/*

  TODO: min-height of scrollbar support
  TODO: revisit naming of state properties: especially scrollTop, barTop, barHeight
  TODO: performance: cache in state all properties that make render/reflow of document (like el2.offsetTop, etc.)
  TODO: add dragger min-height to default styles
  TODO: change name of dragger to something more fitting
  NOTE: take in consideration content height/width change between horizontal/vertical height/width calculations
  TODO: content min/max height support
  TODO: reimplement replaceOverlayScrollbars (new overrideFloatingScrollbar) option
  TODO: don't overwrite vuebar element classess completely, use aC
  TODO: Site: add limitations (no tables, etc.) ?
  TODO: There is a problem with hiding overlayed/0 scrollbars when in vertical+horizonal mode - maybe just add warning to replaceOverlayScrollbars option?
  TODO: el1ScrollInvisibleClass/el1ScrollVisibleClass should be either for X or Y pane, not both

  Upon Completion
  TODO: Validate el1/el2 style attributes (prevent or warn about custom inline styles)
  TODO: SSR support / https://ssr.vuejs.org/en/universal.html#custom-directives
  TODO: Check again if all references (this.ins/this.state/this.config) were refactored properly
  TODO: Check if events are removed properly on destroy method

*/



;(function(){
  'use strict';


  /*------------------------------------*\
    Vuebar Constructor
  \*------------------------------------*/
  function Vuebar(Vue, el, binding, vnode, oldVnode){



    /*------------------------------------*\
      Config
      - Default values that may be overwritten
        on directive intialization
    \*------------------------------------*/
    this.config = {

      scrollThrottle: 10,
      draggerThrottle: 10,
      resizeRefresh: true,
      observerThrottle: 100,
      resizeDebounce: 100,
      unselectableBody: true,
      //replaceOverlayScrollbars: false, // TODO
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

      draggerCommonClass: 'vb-dragger',
      draggerCommonStylerClass: 'vb-dragger-styler',

      draggerYClass: 'vb-dragger-y',
      draggerXClass: 'vb-dragger-x',


    }



    /*------------------------------------*\
      Instances
      - This holds references to elements
        and as well to events & other stuff
      - More fitting name would probably
        be "refs", but I don't want for
        people to confuse it with Vue
        $refs property
    \*------------------------------------*/
    this.ins = {

      // reference to binding
      binding: null,

      // references to directive DOM elements
      el1: null,
      el2: null,
      dragger: null,

      // reference to MutationObserver
      mutationObserver: null,

      // references to timeouts for DOM class manipulation
      scrollingClassTimeout: null,
      draggingClassTimeout: null,
      scrollingPhantomClassTimeout: null,
      draggingPhantomClassTimeout: null,

      // references to a functions we'll need when removing events
      windowResize: null,
      scrollHandler: null,
      wheelHandler: null,

      y: {
        barMousedown: null,
        documentMousemove: null,
        documentMouseup: null,
      },

      x: {
        barMousedown: null,
        documentMousemove: null,
        documentMouseup: null,
      },

    }



    /*------------------------------------*\
      State
      - Don't confuse with Vue state!
      - This holds internal Vuebar state
        for computing positions of
        elements and scrollbar
      - Properties computed for internal
        directive logic & DOM manipulations
    \*------------------------------------*/
    this.state = {

      // constants + cached properties
      nativeScrollbarSize: null,

      // dynamic properties for y plane
      y: {
        visibleRatio: 0, // ratio between container height and scrollable content height
        barTop: 0, // position (top) of dragger in px
        barBaseHeight: 0, // base height of dragger in px
        barClickOffset: 0, // relative position of mouse at the time of clicking on dragger
        scrollPercent: 0, // scroll percentage on y plane
        scrollTop: 0, // position of content scrollTop in px
      },


      // dynamic properties for x plane
      x: {
        visibleRatio: 0, // ratio between container height and scrollable content height
        barLeft: 0, // position (left) of dragger in px
        barBaseWidth: 0, // base width of dragger in px
        barClickOffset: 0, // relative position of mouse at the time of clicking on dragger
        scrollPercent: 0, // scroll percentage on x plane
        scrollLeft: 0,
      },


      // when the dragger is used - can be 'y', 'x' or false
      barDragging: false,


    }





    /*------------------------------------*\
      Validate Markup
    \*------------------------------------*/
    this.validateMarkup = function(){
      if (!el.firstChild) {
        return this.util.warn('Element 1 with v-bar directive doesn\'t have required child element 2.');
      }
      return true;
    }






    /*------------------------------------*\
      Initialize Sub Methods
      - These methods gets called only once
        on initialize()
    \*------------------------------------*/

    // options
    this.initializeOptions = function(){
      // get options object & overwrite defaults with provided options
      // - it will come from directive binding (there is a 'value' property)
      // - or it will come from public method direct options object
      var options = binding.value ? binding.value : (binding ? binding : {});
      for (var key in options){
        this.config[key] = options[key];
      }
    }


    // create and reference event listeners
    this.initializeEvents = function(){

      // create and reference event listeners
      this.ins.y.barMousedown = this.barMousedown('y');
      this.ins.x.barMousedown = this.barMousedown('x');

      this.ins.y.documentMousemove = this.documentMousemove('y');
      this.ins.x.documentMousemove = this.documentMousemove('x');

      this.ins.y.documentMouseup = this.documentMouseup('y');
      this.ins.x.documentMouseup = this.documentMouseup('x');

      this.ins.windowResize = this.windowResize();
      this.ins.scrollHandler = this.scrollHandler();
      this.ins.wheelHandler = this.wheelHandler();

      // add events
      this.ins.el2.addEventListener('scroll', this.ins.scrollHandler, 0);
      this.ins.draggerY.addEventListener('mousedown', this.ins.y.barMousedown, 0);
      this.ins.draggerX.addEventListener('mousedown', this.ins.x.barMousedown, 0);

      // - wheel event is only needed when preventParentScroll option is enabled
      this.config.preventParentScroll ? this.ins.el2.addEventListener('wheel', this.ins.wheelHandler, 0) : null;

      // - resize event is only needed when resizeRefresh option is enabled
      this.config.resizeRefresh ? window.addEventListener('resize', this.ins.windowResize, 0) : null;

    }



    // setup element styles and classess
    this.initializeStyles = function(){

      // need to have visibleRatios calculate beforehand...
      //this.computeVisibleRatios();

      // el1 styles and class
      this.util.aC(this.ins.el1, this.config.el1Class);
      this.ins.el1.style.position = 'relative';
      this.ins.el1.style.overflow = 'hidden';

      // el2 styles and class
      this.util.aC(this.ins.el2, this.config.el2Class);
      this.ins.el2.style.display = 'block';
      this.ins.el2.style.overflowX = 'scroll';
      this.ins.el2.style.overflowY = 'scroll';
      this.ins.el2.style.width = '100%';
      this.ins.el2.style.height = '100%';
      this.util.cS(this.ins.el2, 'BoxSizing', 'content-box'); // safe guard for user styling


      // do we need scrollbars?
      var scrollbarsWanted = (this.state.y.visibleRatio<1 || this.state.x.visibleRatio<1) &&        this.state.nativeScrollbarSize;

      // how much of el2 to hide... if native scrollbar width is 0 it's either overlay scrollbar or hidden
      // ... so let's use constant of 20px because it's impossible (?) to calculate scrollbar width in this case
      // and 20px is a safe value that should cover 99% of cases (PRs welcome!)
      var pxToHide = this.state.nativeScrollbarSize ? this.state.nativeScrollbarSize : 20; // <---- TODO?


      // do the magic
      if (scrollbarsWanted){

        // for in-the-flow scrollbars (not overlayed)
        // hide el2 scrollbar by making it larger than el1 overflow boundaries
        if (this.state.nativeScrollbarSize>0) {
          this.ins.el2.style.width = 'calc(100% + ' + pxToHide + 'px)';
          this.ins.el2.style.height = 'calc(100% + ' + pxToHide + 'px)';
        }

        // for overlayed/0 scrollbars
        // add padding to overlayed/0 scrollbars, so the proper el2 content won't get cut off
        else {
          // TODO: todo this
        }


      }



    }


    // mutation observer for content changes outside Vue state
    this.initializeMutationObserver = function(){
      if (typeof MutationObserver === typeof void 0) { return null }

      var observer = new MutationObserver(this.util.throttle(function(mutations) {
        this.refresh();
      }.bind(this), this.config.observerThrottle));

      observer.observe(this.ins.el2, {
        childList: true,
        characterData: true,
        subtree: true,
      });

      this.ins.mutationObserver = observer;

      return observer;
    }




    /*------------------------------------*\
      Initialize Scrollbar
    \*------------------------------------*/
    this.initialize = function(){

      // safeguard to not initialize vuebar when it's already initialized
      if (el.$_vuebar) return this.util.warn('Can\'t initialize on already initialized element.');

      // validate on directive bind if the markup is OK
      if (!this.validateMarkup()) return;

      // initialize options...
      this.initializeOptions();

      //  native scrollbar size
      this.state.nativeScrollbarSize = this.util.getNativeScrollbarSize(el.firstElementChild);

      // add binding and els to state
      this.ins.binding = binding.value ? binding : null;
      this.ins.el1 = el;
      this.ins.el2 = el.firstElementChild;

      // create draggers
      this.ins.draggerY = this.createDragger('y');
      this.ins.draggerX = this.createDragger('x');

      // initialize events and observer...
      this.initializeEvents();
      this.initializeMutationObserver();

      // initialize styles...
      this.initializeStyles();

      // expose instance on vuebar element (https://vuejs.org/v2/style-guide/#Private-property-names-essential)
      this.ins.el1.$_vuebar = this;

      // initial calculations using refresh scrollbar
      this.refresh({alsoImmediately: true});

      // return instance
      return this;

    }




    /*------------------------------------*\
      Destroy Scrollbar
    \*------------------------------------*/
    this.destroy = function(options){
      var options = options ? options : {};

      // clear events
      this.ins.draggerY.removeEventListener('mousedown', this.ins.y.barMousedown, 0);
      this.ins.draggerX.removeEventListener('mousedown', this.ins.x.barMousedown, 0);
      this.ins.el2.removeEventListener('scroll', this.ins.scrollHandler, 0);
      this.ins.el2.removeEventListener('wheel', this.ins.wheelHandler, 0);
      window.removeEventListener('resize', this.ins.windowResize, 0);

      // disconnect mutation observer
      this.ins.mutationObserver ? this.ins.mutationObserver.disconnect() : null;

      // clear el1 classes
      this.util.rC(this.ins.el1, this.config.el1Class);
      this.util.rC(this.ins.el1, this.config.el1ScrollVisibleClass);
      this.util.rC(this.ins.el1, this.config.el1ScrollInvisibleClass);
      this.util.rC(this.ins.el1, this.config.el1ScrollingClass);
      this.util.rC(this.ins.el1, this.config.el1ScrollingPhantomClass);
      this.util.rC(this.ins.el1, this.config.el1DraggingClass);

      // clear el1 styles
      if (!options.skipStyles) {
        this.ins.el1.style.position = '';
        this.ins.el1.style.overflow = '';
      }

      // clear el2 classes
      this.util.rC(this.ins.el2, this.config.el2Class);

      // clear el2 styles
      if (!options.skipStyles) {
        this.ins.el2.style.boxSizing = '';
        this.ins.el2.style.display = '';
        this.ins.el2.style.overflowX = '';
        this.ins.el2.style.overflowY = '';
        this.ins.el2.style.height = '';
        this.ins.el2.style.width = '';
        //this.ins.el2.style.marginRight = '';
        this.ins.el2.style.paddingRight = '';
      }

      // clear dragger
      this.ins.draggerY.removeChild(this.ins.draggerY.firstChild);
      this.ins.draggerX.removeChild(this.ins.draggerX.firstChild);
      this.ins.el1.removeChild(this.ins.draggerY);
      this.ins.el1.removeChild(this.ins.draggerX);

      // clear timeouts that may be still running
      this.ins.scrollingPhantomClassTimeout ?
      clearTimeout(this.ins.scrollingPhantomClassTimeout) : null;
      this.ins.draggingPhantomClassTimeout ?
      clearTimeout(this.ins.draggingPhantomClassTimeout) : null;

      // delete instance from vuebar element
      delete this.ins.el1.$_vuebar;

      // return el1 (not sure why, but why not)
      return this.ins.el1;

    }





    /*------------------------------------*\
      Refresh Scrollbar
    \*------------------------------------*/
    this.refresh = function(options){
      var options = options ? options : {};
      if (options.alsoImmediately) {
        this.computeVisibleRatios();
        this.computeBarTopOnScroll();
        this.computeBarLeftOnScroll();
        this.computeBarBaseHeight();
        this.computeBarBaseWidth();
        this.updateDraggers();
      }
      Vue.nextTick(function(){
        if (!el.$_vuebar) return;
        this.computeVisibleRatios();
        this.computeBarTopOnScroll();
        this.computeBarLeftOnScroll();
        this.computeBarBaseHeight();
        this.computeBarBaseWidth();
        this.updateDraggers();
      }.bind(this));
    }














    /*------------------------------------*\
      Computing Properties
    \*------------------------------------*/

    this.computeVisibleRatios = function(){
      this.state.y.visibleRatio = (this.ins.el2.clientHeight / this.ins.el2.scrollHeight);
      this.state.x.visibleRatio = (this.ins.el2.clientWidth / this.ins.el2.scrollWidth);
    }


    //this.computeScrollTop = function(){
    //  this.state.y.scrollTop = this.state.y.barTop * (this.ins.el2.scrollHeight / this.ins.el2.clientHeight);
    //}

    this.computeScrollTop = function(){

      // calculate scroll percentage...
      // I SPENT 5 HOURS to come up with these 2 lines below - lets say I've suffered "writer's block" =) / Dom
      var barHeight = this.ins.draggerY.offsetHeight;
      this.state.y.scrollPercent = this.state.y.barTop / (this.ins.el2.clientHeight - barHeight);

      // convert scroll percentage to scrollTop pixels
      var availablePixels = (this.ins.el2.scrollHeight - this.ins.el2.clientHeight);
      var scrollTop = availablePixels * this.state.y.scrollPercent;

      //console.table({
      //  barHeight: barHeight,
      //  scrollPercent: (this.state.y.scrollPercent*100)+'%',
      //  el2ScrollHeight: this.ins.el2.scrollHeight,
      //  el2ClientHeight: this.ins.el2.clientHeight,
      //  availablePixels: availablePixels,
      //  scrollTop: scrollTop,
      //});

      this.state.y.scrollTop = scrollTop;
    }



    this.computeScrollLeft = function(){

      // calculate scroll percentage...
      var barWidth = this.ins.draggerX.offsetWidth;
      this.state.x.scrollPercent = this.state.x.barLeft / (this.ins.el2.clientWidth - barWidth);

      // convert scroll percentage to scrollTop pixels
      var availablePixels = (this.ins.el2.scrollWidth - this.ins.el2.clientWidth);
      var scrollLeft = availablePixels * this.state.x.scrollPercent;

      this.state.x.scrollLeft = scrollLeft;
    }





    // for y scrollbar
    this.computeBarBaseHeight = function(){
      if (this.state.y.visibleRatio >= 1) {
        this.state.y.barBaseHeight = 0;
      } else {
        this.state.y.barBaseHeight = this.ins.el2.clientHeight * this.state.y.visibleRatio;
      }
    }


    // for x scrollbar
    this.computeBarBaseWidth = function(){
      if (this.state.x.visibleRatio >= 1) {
        this.state.x.barBaseWidth = 0;
      } else {
        this.state.x.barBaseWidth = this.ins.el2.clientWidth * this.state.x.visibleRatio;
      }
    }




    this.computeBarTopOnDrag = function(event){

      // get bar height
      var barHeight = this.ins.draggerY.offsetHeight;

      // get relative mouse y position (mouse position - el1 offset from window)
      var relativeMouseY = (event.clientY - this.ins.el1.getBoundingClientRect().top);

      // if bar is trying to go over top
      if (relativeMouseY <= this.state.y.barClickOffset) {
        this.state.y.barTop = 0;
      }

      // alternative: if bar is trying to go over top
      //if (this.state.y.scrollPercent <= 0.0) {
      //  this.state.y.barTop = 0;
      //}

      // if bar is moving between top and bottom
      if (relativeMouseY > this.state.y.barClickOffset) {
        this.state.y.barTop = relativeMouseY - this.state.y.barClickOffset;
      }

      // if bar is trying to go over bottom
      if ( (this.state.y.barTop + barHeight ) >= this.ins.el2.clientHeight ) {
        this.state.y.barTop = this.ins.el2.clientHeight - barHeight;
      }

      // debug
      //this.state.y.barTop = relativeMouseY - this.state.y.barClickOffset;

    }



    this.computeBarLeftOnDrag = function(event){

      // get bar width
      var barWidth = this.ins.draggerX.offsetWidth;

      // get relative mouse x position (mouse position - el1 offset from window)
      var relativeMouseX = (event.clientX - this.ins.el1.getBoundingClientRect().left);

      // if bar is trying to go over top
      if (relativeMouseX <= this.state.x.barClickOffset) {
        this.state.x.barLeft = 0;
      }

      // if bar is moving between top and bottom
      if (relativeMouseX > this.state.x.barClickOffset) {
        this.state.x.barLeft = relativeMouseX - this.state.x.barClickOffset;
      }

      // if bar is trying to go over bottom
      if ( (this.state.x.barLeft + barWidth ) >= this.ins.el2.clientWidth ) {
        this.state.x.barLeft = this.ins.el2.clientWidth - barWidth;
      }

      // debug
      //this.state.x.barLeft = relativeMouseX - this.state.x.barClickOffset;

    }







    this.computeBarTopOnScroll = function(){
      var el2ClientHeight = this.ins.el2.clientHeight;
      var el2ScrollHeight = this.ins.el2.scrollHeight;
      var el2ScrollTop = this.ins.el2.scrollTop;
      var draggerYOffsetHeight = this.ins.draggerY.offsetHeight;

      var scrollPercent = el2ScrollTop / (el2ScrollHeight - el2ClientHeight);
      var availablePixels = (el2ClientHeight - draggerYOffsetHeight);
      this.state.y.barTop = availablePixels * scrollPercent;
    }



    this.computeBarLeftOnScroll = function(){
      var el2ClientWidth = this.ins.el2.clientWidth;
      var el2ScrollWidth = this.ins.el2.scrollWidth;
      var el2ScrollLeft = this.ins.el2.scrollLeft;
      var draggerXOffsetWidth = this.ins.draggerX.offsetWidth;

      var scrollPercent = el2ScrollLeft / (el2ScrollWidth - el2ClientWidth);
      var availablePixels = (el2ClientWidth - draggerXOffsetWidth);
      this.state.x.barLeft = availablePixels * scrollPercent;
    }








    /*------------------------------------*\
      Styles & DOM
    \*------------------------------------*/
    this.createDragger = function(plane){

      var dragger = document.createElement('div');
      var draggerStyler = document.createElement('div');

      this.util.aC(dragger, this.config.draggerCommonClass);
      this.util.aC(draggerStyler, this.config.draggerCommonStylerClass);
      if (plane==='y') this.util.aC(dragger, this.config.draggerYClass);
      if (plane==='x') this.util.aC(dragger, this.config.draggerXClass);

      dragger.style.position = 'absolute';

      dragger.appendChild(draggerStyler);
      this.ins.el1.appendChild(dragger);

      return dragger;
    }


    this.updateDraggers = function(options){
      var options = options ? options : {};

      // do we need draggers visible?
      var scrollbarYWanted = !!this.state.nativeScrollbarSize && this.state.y.visibleRatio<1;
      var scrollbarXWanted = !!this.state.nativeScrollbarSize && this.state.x.visibleRatio<1;

      if (scrollbarYWanted) {
        this.ins.draggerY.style.display = '';
      } else {
        this.ins.draggerY.style.display = 'none';
      }

      if (scrollbarXWanted) {
        this.ins.draggerX.style.display = '';
      } else {
        this.ins.draggerX.style.display = 'none';
      }


      if (scrollbarYWanted || scrollbarXWanted) {
        this.util.rC(this.ins.el1, this.config.el1ScrollInvisibleClass);
        this.util.aC(this.ins.el1, this.config.el1ScrollVisibleClass);
      } else {
        this.util.rC(this.ins.el1, this.config.el1ScrollVisibleClass);
        this.util.aC(this.ins.el1, this.config.el1ScrollInvisibleClass);
        // we can stop here since we don't need calculations if scrollbars are not wanted at all
        return;
      }


      // setting dragger styles
      this.ins.draggerY.style.height = parseInt(Math.round(this.state.y.barBaseHeight)) + 'px';
      this.ins.draggerY.style.top = parseInt(Math.round(this.state.y.barTop)) + 'px';

      this.ins.draggerX.style.width = parseInt(Math.round(this.state.x.barBaseWidth)) + 'px';
      this.ins.draggerX.style.left = parseInt(Math.round(this.state.x.barLeft)) + 'px';

      //this.ins.draggerY.style.height = Math.ceil( this.state.y.barBaseHeight ) + 'px';
      //this.ins.draggerY.style.top = Math.ceil( this.state.y.barTop ) + 'px';



      if (options.withScrollingClasses) {

        // add scrolling class
        this.util.aC(this.ins.el1, this.config.el1ScrollingClass);

        // remove scrolling class
        this.ins.scrollingClassTimeout ?
        clearTimeout(this.ins.scrollingClassTimeout) : null;

        this.ins.scrollingClassTimeout = setTimeout(function() {
          this.util.rC(this.ins.el1, this.config.el1ScrollingClass);
        }.bind(this), this.config.scrollThrottle + 5);



        // add phantom scrolling class
        this.util.aC(this.ins.el1, this.config.el1ScrollingPhantomClass);

        // remove phantom scrolling class
        this.ins.scrollingPhantomClassTimeout ?
        clearTimeout(this.ins.scrollingPhantomClassTimeout) : null;
        this.ins.scrollingPhantomClassTimeout = setTimeout(function() {
          this.util.rC(this.ins.el1, this.config.el1ScrollingPhantomClass);
        }.bind(this), this.config.scrollThrottle + this.config.scrollingPhantomDelay);

      }

    }




    this.preventParentScroll = function(event){
      if (this.state.y.visibleRatio >= 1) return false;

      var scrollDist = this.ins.el2.scrollHeight - this.ins.el2.clientHeight;
      var scrollTop = this.ins.el2.scrollTop;

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
      this.ins.el2.scrollTop = this.state.y.scrollTop;
      this.ins.el2.scrollLeft = this.state.x.scrollLeft;
    }







    /*------------------------------------*\
      Events & Handlers
    \*------------------------------------*/

    this.scrollHandler = function(){
      return this.util.throttle(function(event){
        this.computeVisibleRatios();
        this.computeBarBaseHeight(); // fallback for an undetected content change
        this.computeBarBaseWidth();
        if (!this.state.barDragging) {
          this.computeBarTopOnScroll();
          this.computeBarLeftOnScroll();
          this.updateDraggers({withScrollingClasses: true});
        }
      }.bind(this), this.config.scrollThrottle);
    }


    this.wheelHandler = function(){
      return function(event){
        this.preventParentScroll(event);
      }.bind(this);
    }


    this.documentMousemove = function(plane){
      return this.util.throttle(function(event){

        if (plane==='y') this.computeBarTopOnDrag(event);
        if (plane==='x') this.computeBarLeftOnDrag(event);

        this.updateDraggers();

        // we need to calculate both, so the other scrollbar
        // wont return to it's old scroll position
        // "scroll then drag problem"
        this.computeScrollTop();
        this.computeScrollLeft();

        this.updateScroll();

      }.bind(this), this.config.draggerThrottle);
    }


    this.documentMouseup = function(plane){
      return function(event){

        //
        this.state.barDragging = false;

        // enable user select
        this.ins.el1.style.userSelect = '';
        this.config.unselectableBody ? this.util.cS(document.body, 'UserSelect', '') : null;

        // remove dragging class
        this.util.rC(this.ins.el1, this.config.el1DraggingClass);
        this.ins.draggingPhantomClassTimeout = setTimeout(function() {
          this.util.rC(this.ins.el1, this.config.el1DraggingPhantomClass);
        }.bind(this), this.config.draggingPhantomDelay);


        // remove events
        document.removeEventListener('mousemove', this.ins[plane].documentMousemove, 0);
        document.removeEventListener('mouseup', this.ins[plane].documentMouseup, 0);

      }.bind(this);

    }


    this.barMousedown = function(plane){
      return function(event){

        // do nothing if it's not left mouse button
        if ( event.which!==1 ) { return false }


        if (plane==='y') {
          this.state.barDragging = 'y';
          this.state.y.barClickOffset = event.offsetY;
        }

        if (plane==='x') {
          this.state.barDragging = 'x';
          this.state.x.barClickOffset = event.offsetX;
        }

        // disable user select
        this.ins.el1.style.userSelect = 'none';
        this.config.unselectableBody ? this.util.cS(document.body, 'UserSelect', 'none') : null;

        // add dragging class
        this.util.aC(this.ins.el1, this.config.el1DraggingClass);
        this.ins.draggingPhantomClassTimeout ?
        clearTimeout(this.ins.draggingPhantomClassTimeout) : null;
        this.util.aC(this.ins.el1, this.config.el1DraggingPhantomClass);


        // add events
        document.addEventListener('mousemove', this.ins[plane].documentMousemove, 0);
        document.addEventListener('mouseup', this.ins[plane].documentMouseup, 0);


      }.bind(this);
    }






    this.windowResize = function(){
      return this.util.debounce(function(event){
        this.refresh();
      }.bind(this), this.config.resizeDebounce);
    }










    /*------------------------------------*\
      Convenience Methods
      - Warning! Don't use yet.
      - This method API will change.
    \*------------------------------------*/
    this.scrollTo = function(positionY, positionX){
      // TODO: scroll to top
      // TODO: scroll to bottom
      // TODO: scroll to child element
      // TODO: scroll to position
      // TODO: scroll by specific amount of distance
      // TODO: smoothly animated scroll
      if (!positionY) return this.util.warn('[scrollTo]: You need to specify position to scroll.');
      if (positionY === 'top') { this.ins.el2.scrollTop = 0; }
      else if (positionY === 'bottom') { this.ins.el2.scrollTop = this.ins.el2.scrollHeight; }
      else {
        this.ins.el2.scrollTop = positionY;
        this.ins.el2.scrollLeft = positionX;
      }
    }











    /*------------------------------------*\
      Utils
    \*------------------------------------*/
    this.util = {


      /*------------------------------------*\
        Warning
      \*------------------------------------*/
      warn: function(message){
        var message = '[Vuebar]: ' + message;
        return Vue.util && Vue.util.warn ? Vue.util.warn(message) : window.console.warn(message);
      },



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
        [C]ompat [S]tyle
        Style Vendor Prefixes Helper
      \*------------------------------------*/
      cS: function(element, property, value) {
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

      // hasClass
      hC: function(el, classToCheck) {
        if (el.classLists) { return el.classList.contains(classToCheck); }
        else { return (new RegExp('\\b'+ classToCheck+'\\b')).test(el.className); }
      },

      // addClass
      aC: function(el, classToAdd) {
        var hC = (this.util && this.util.hC) ? this.util.hC : this.hC; // fix for < ie9
        if (el.classList) { el.classList.add(classToAdd); }
        else if (!hC(el, classToAdd)) { el.className += ' ' + classToAdd };
      },

      // removeClass
      rC: function(el, classToRemove) {
        if (el.classList) el.classList.remove(classToRemove);
        else el.className = el.className.replace(new RegExp('\\b'+ classToRemove+'\\b', 'g'), '');
      },




      /*------------------------------------*\
        Calculate scrollbar size (width) in element
        - if the size is 0 it means the scrollbar is floated/overlayed
        - accepts "container" paremeter because ie & edge can have different
        scrollbar behaviors for different elements using '-ms-overflow-style'
        - useful: https://gist.github.com/paulirish/5d52fb081b3570c81e3a
      \*------------------------------------*/
      getNativeScrollbarSize: function(container) {
        var container = container ? container : document.body;

        var fullWidth = 0;
        var barWidth = 0;

        var wrapper = document.createElement('div');
        var child = document.createElement('div');

        wrapper.style.display = 'block';
        wrapper.style.boxSizing = 'content-box';
        wrapper.style.position = 'absolute';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.opacity = '0';
        wrapper.style.bottom = '0';
        wrapper.style.right = '0';
        wrapper.style.width = '100px';
        wrapper.style.height = '30px';
        wrapper.style.overflow = 'hidden';

        wrapper.appendChild(child);
        container.appendChild(wrapper);

        fullWidth = child.offsetWidth;

        wrapper.style.overflowY = 'scroll';

        // fix for safari https://github.com/DominikSerafin/vuebar/pull/45
        child.style.height = '60px';
        child.style.width = '100%';

        barWidth = fullWidth - child.offsetWidth;

        container.removeChild(wrapper);

        return barWidth;
      },


    }





  }






  /*------------------------------------*\
    Vuebar For Installation
  \*------------------------------------*/
  function VuebarPlugin(Vue, options){



    /*------------------------------------*\
      Custom Directive Name
    \*------------------------------------*/
    options = options || {};
    options.directive = options.directive || 'bar';



    /*------------------------------------*\
      Public Methods Install
    \*------------------------------------*/
    Vue.$_Vuebar = Vuebar;
    Vue.prototype.$_Vuebar = Vuebar;



    /*------------------------------------*\
      Directive Install
    \*------------------------------------*/
    Vue.directive(options.directive, {

      inserted: function(el, binding, vnode){
        (new Vuebar(Vue, el, binding, vnode)).initialize();
      },

      componentUpdated: function(el, binding, vnode, oldVnode){
        el.$_vuebar ? el.$_vuebar.refresh() : null;
      },

      unbind: function(el, binding, vnode, oldVnode){
        // we shouldn't clear styles because it actually doesn't matter that much
        // the element will be always deleted on unbind and its styles also
        // and if we do clear styles then it looks bad on transitions
        el.$_vuebar ? el.$_vuebar.destroy({skipStyles: true}) : null;
      },

    });

  }


  /*------------------------------------*\
    Expose / Autoinstall
  \*------------------------------------*/
  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = VuebarPlugin;
  } else if (typeof define === 'function' && define.amd) {
    define(function () { return VuebarPlugin });
  } else if (typeof window !== typeof void 0) {
    window.Vuebar = VuebarPlugin;
  }

  //if (typeof Vue !== typeof void 0) {
  //  Vue.use(VuebarPlugin);
  //}


})();
