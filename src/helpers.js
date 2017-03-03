/*------------------------------------*\
    debounce
    https://remysharp.com/2010/07/21/throttling-function-calls
\*------------------------------------*/
export var debounce = function(fn, delay) {
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
export var throttle = function(fn, threshhold, scope) {
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
export var hasClass = function(el, className) {
    return el.classList ? el.classList.contains(className) : new RegExp('\\b'+ className+'\\b').test(el.className);
}

export var addClass = function(el, className) {
    if (el.classList) el.classList.add(className);
    else if (!hasClass(el, className)) el.className += ' ' + className;
}

export var removeClass = function(el, className) {
    if (el.classList) el.classList.remove(className);
    else el.className = el.className.replace(new RegExp('\\b'+ className+'\\b', 'g'), '');
}

