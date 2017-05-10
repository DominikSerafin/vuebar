# Vue Native Scrollbar

Vue directive for custom scrollbar that uses native scroll behavior. Lightweight, performant, customizable and without dependencies. Used successfully in production.


## Important

- you must set explicit height of el1
- $forceUpdate if the scrollbar doesnt update correctly




## Config Options

- `scrollThrottle`: (int) (default 10) how frequently in ms should dragger position calculations take place on scroll event (setting this above 30 will make dragger position change choppy, but may help with performance in extreme situations)

- `mousemoveThrottle`: (int) (default 10) how frequently in ms should scroll position update when using dragger (setting this above 30 will make scroll sync choppy, but may help with performance in extreme situations)

- `phantomDraggingClassDelay`: (int) (default 1000) how long in ms should phantom dragging class stay applied to element (warning: setting this below `scrollThrottle` may have some unforeseen effects)

- `phantomScrollingClassDelay`: (int) (default 1000) how long in ms should phantom scrolling class stay applied to element

- `unselectableBody`: (bool) (default true) disable user select on body when using dragger, if this is false then user select will be only disabled on element with directive

- `resizeRefresh`: (bool) (default true) refresh scroll & dragger positions on window resize

- `resizeDebounce`: (int) (default 100) debounce value in ms controlling how frequently resize refresh is fired

- `preventParentScroll` (bool) (default false) prevent parent taking over scrolling after reaching bottom or top of vue native scrollbar element. this feature is in beta. right now it supports only detecting mouse wheel scroll event and doesn't support touch scrolling. pull requests welcome.



## Config Options - Classes
- `el1Class`: (string) (default 'vns') el1 class
- `el1ScrollEnabledClass`: (string) (default 'vns-enabled') added dynamically when the scrollbar is enabled
- `el1ScrollDisabledClass`: (string) (default 'vns-disabled') added dynamically when the scrollbar is disabled (there's nothing to scroll)
- `el1ScrollingClass`: (string) (default 'vns-scrolling') added dynamically on scrolling
- `el1ScrollingPhantomClass`: (string) (default 'vns-scrolling-phantom') added dynamically on scrolling and removed after `phantomScrollingClassDelay`
- `el1DraggingClass`: (string) (default 'vns-dragging') added dynamically when the dragger is dragged or pressed
- `el1DraggingPhantomClass`: (string) (default 'vns-dragging-phantom') added dynamically when the dragger is dragger or pressed and removed after `phantomDraggingClassDelay`
- `draggerClass`: (string) (default 'vns-dragger') dragger class
- `draggerStylerClass`: (string) (default 'vns-dragger-styler') dragger styler class




## Official Website w/ Demo
[serafin.io/vue-native-scrollbar/](http://serafin.io/vue-native-scrollbar/)

## NPM
[npmjs.com/package/vue-native-scrollbar](https://www.npmjs.com/package/vue-native-scrollbar)



## Notes

Inspired by [nanoScroller](https://jamesflorentino.github.io/nanoScrollerJS/)

Developed for [GGather.com](https://ggather.com/)
