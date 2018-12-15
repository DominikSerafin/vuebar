






/* install */
Vue.use(Vuex);


/* store */

const store = new Vuex.Store({

  state: {

    navActive: 0, // for rwd,

  },

  mutations: {

    navActive: function(s, p) {
      s.navActive = p;
    },

  },

});





/* topbar */

var topbar = new Vue({

  el: '#topbar',

  store: store,

  data: function(){
    return {
      badgesOn: false,
    }
  },

  mounted: function(){
    setTimeout(function () {
      this.badgesOn = true;
    }.bind(this), 500);
  },

});





/* nav */

var navWrapper = new Vue({

  el: '#nav-wrapper',

  store: store,

  data: function(){
    return {
    }
  },

});






















/* iframe component */
Vue.component('browser', {

  name: 'browser',

  props: {

    'url': {
      type: String,
      required: true,
    },

  },

  data: function(){
    return {
      widthMobile: false,
      openCode: false,
    }
  },

  watch: {
    openCode: function(newVal){
      if (newVal) {
        this.$nextTick(function(){
          var code = this.$refs.code;
          hljs.highlightBlock(code);
        });
      }
    },
  },

  template: `<div class="browser" :class="{'mod-width-mobile': widthMobile}">


    <div class="browser-top">

      <div class="browser-omnibox-icon mod-back">
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" version="1.1" width="24px" height="24px">
        <g id="surface1">
        <path style=" " d="M 11.78125 2.28125 L 2.78125 11.28125 L 2.09375 12 L 2.78125 12.71875 L 11.78125 21.71875 L 13.21875 20.28125 L 5.9375 13 L 22 13 L 22 11 L 5.9375 11 L 13.21875 3.71875 Z "/>
        </g>
        </svg>

      </div>

      <div class="browser-omnibox-icon mod-forward">
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" version="1.1" width="24px" height="24px">
        <g id="surface1">
        <path style=" " d="M 12.21875 2.28125 L 10.78125 3.71875 L 18.0625 11 L 2 11 L 2 13 L 18.0625 13 L 10.78125 20.28125 L 12.21875 21.71875 L 21.21875 12.71875 L 21.90625 12 L 21.21875 11.28125 Z "/>
        </g>
        </svg>
      </div>

      <div class="browser-omnibox-icon mod-refresh">
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" version="1.1" width="24px" height="24px">
        <g id="surface1">
        <path style=" " d="M 21 1.90625 L 18.46875 4.4375 C 16.707031 2.941406 14.472656 2 12 2 C 6.464844 2 2 6.464844 2 12 C 2 17.535156 6.464844 22 12 22 C 17.535156 22 22 17.535156 22 12 L 20 12 C 20 16.464844 16.464844 20 12 20 C 7.535156 20 4 16.464844 4 12 C 4 7.535156 7.535156 4 12 4 C 13.921875 4 15.660156 4.695313 17.0625 5.84375 L 14.90625 8 L 21 8 Z "/>
        </g>
        </svg>
      </div>

      <div class="browser-omnibox">

        {{url}}



        <a :href="url" target="_blank" rel="noopener noreferrer" class="browser-omnibox-icon mod-external" title="Open URL in new tab">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px">
          <path style="line-height:normal;text-indent:0;text-align:start;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:#000;text-transform:none;block-progression:tb;isolation:auto;mix-blend-mode:normal" d="M 5 3 C 3.9069372 3 3 3.9069372 3 5 L 3 19 C 3 20.093063 3.9069372 21 5 21 L 19 21 C 20.093063 21 21 20.093063 21 19 L 21 12 L 19 12 L 19 19 L 5 19 L 5 5 L 12 5 L 12 3 L 5 3 z M 14 3 L 14 5 L 17.585938 5 L 8.2929688 14.292969 L 9.7070312 15.707031 L 19 6.4140625 L 19 10 L 21 10 L 21 3 L 14 3 z" font-weight="400" font-family="sans-serif" white-space="normal" overflow="visible"/>
          </svg>
        </a>

      </div>




      <button type="button" class="browser-omnibox-icon mod-code" :class="{'mod-active': openCode}" @click.prevent="openCode=!openCode" title="Show code">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" version="1.1" width="50px" height="50px">
        <path d="M 29.125 7.34375 L 17.125 41.34375 L 20.875 42.65625 L 32.875 8.65625 Z M 9.9375 13.375 L 1.25 23.71875 L 0.1875 25 L 1.25 26.28125 L 9.9375 36.65625 L 13.03125 34.09375 L 5.40625 25 L 13 15.9375 Z M 40.0625 13.375 L 37 15.9375 L 44.59375 25 L 37 34.0625 L 40.09375 36.625 L 48.71875 26.28125 L 49.78125 25 L 48.71875 23.71875 Z "/>
        </svg>
      </button>


      <button type="button" class="browser-omnibox-icon mod-width-mobile" :class="{'mod-active': widthMobile}" @click.prevent="widthMobile=!widthMobile" title="Resize to mobile version">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30px" height="30px">
          <path d="M21,1H9C7.895,1,7,1.895,7,3v24c0,1.105,0.895,2,2,2h12c1.105,0,2-0.895,2-2V3C23,1.895,22.105,1,21,1z M15,27 c-0.552,0-1-0.448-1-1c0-0.552,0.448-1,1-1s1,0.448,1,1C16,26.552,15.552,27,15,27z M21,24H9V4h12V24z"/>
        </svg>
      </button>



    </div>

    <div class="browser-window">

      <div v-if="openCode" class="browser-code" >
        <span ref="code"><slot name="code"></slot></span>
      </div>


      <iframe :src="url" frameborder="0" width="100%" height="400"></iframe>


    </div>

  </div>`,

});















/* browser */
var browser = new Vue({
  el: '[vue-browser]',
  store: store,
  data: function(){
    return {
    }
  },
});








/* remove parsing class from html */

function removeClass(el, className){
  if (el.classList)
    el.classList.remove(className);
  else
    el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
}


removeClass(window.document.documentElement, 'mod-js-parsing');
