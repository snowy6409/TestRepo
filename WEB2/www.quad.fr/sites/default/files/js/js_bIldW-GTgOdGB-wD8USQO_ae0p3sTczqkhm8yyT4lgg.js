/* NProgress, (c) 2013, 2014 Rico Sta. Cruz - http://ricostacruz.com/nprogress
 * @license MIT */

;(function(root, factory) {

  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.NProgress = factory();
  }

})(this, function() {
  var NProgress = {};

  NProgress.version = '0.2.0';

  var Settings = NProgress.settings = {
    minimum: 0.08,
    easing: 'linear',
    positionUsing: '',
    speed: 350,
    trickle: true,
    trickleSpeed: 250,
    showSpinner: true,
    barSelector: '[role="bar"]',
    spinnerSelector: '[role="spinner"]',
    parent: 'body',
    template: '<div class="bar" role="bar"><div class="peg"></div></div><div class="spinner" role="spinner"><div class="spinner-icon"></div></div>'
  };

  /**
   * Updates configuration.
   *
   *     NProgress.configure({
   *       minimum: 0.1
   *     });
   */
  NProgress.configure = function(options) {
    var key, value;
    for (key in options) {
      value = options[key];
      if (value !== undefined && options.hasOwnProperty(key)) Settings[key] = value;
    }

    return this;
  };

  /**
   * Last number.
   */

  NProgress.status = null;

  /**
   * Sets the progress bar status, where `n` is a number from `0.0` to `1.0`.
   *
   *     NProgress.set(0.4);
   *     NProgress.set(1.0);
   */

  NProgress.set = function(n) {
    var started = NProgress.isStarted();

    n = clamp(n, Settings.minimum, 1);
    NProgress.status = (n === 1 ? null : n);

    var progress = NProgress.render(!started),
        bar      = progress.querySelector(Settings.barSelector),
        speed    = Settings.speed,
        ease     = Settings.easing;

    progress.offsetWidth; /* Repaint */

    queue(function(next) {
      // Set positionUsing if it hasn't already been set
      if (Settings.positionUsing === '') Settings.positionUsing = NProgress.getPositioningCSS();

      // Add transition
      css(bar, barPositionCSS(n, speed, ease));

      if (n === 1) {
        // Fade out
        css(progress, {
          transition: 'none',
          opacity: 1
        });
        progress.offsetWidth; /* Repaint */

        setTimeout(function() {
          //css(progress, {
          css(bar, {        
            transition: 'all ' + speed + 'ms linear',
            /*opacity: 0, */
            // GLG, JEM version :
            opacity: 0,
            transform: 'translate3d(100%,0,0)',
          });
          setTimeout(function() {
            NProgress.remove();
            next();
          }, speed);
        }, speed);
      } else {
        setTimeout(next, speed);
      }
    });

    return this;
  };

  NProgress.isStarted = function() {
    return typeof NProgress.status === 'number';
  };

  /**
   * Shows the progress bar.
   * This is the same as setting the status to 0%, except that it doesn't go backwards.
   *
   *     NProgress.start();
   *
   */
  NProgress.start = function() {
    if (!NProgress.status) NProgress.set(0);

    var work = function() {
      setTimeout(function() {
        if (!NProgress.status) return;
        NProgress.trickle();
        work();
      }, Settings.trickleSpeed);
    };

    if (Settings.trickle) work();

    return this;
  };

  /**
   * Hides the progress bar.
   * This is the *sort of* the same as setting the status to 100%, with the
   * difference being `done()` makes some placebo effect of some realistic motion.
   *
   *     NProgress.done();
   *
   * If `true` is passed, it will show the progress bar even if its hidden.
   *
   *     NProgress.done(true);
   */

  NProgress.done = function(force) {
    if (!force && !NProgress.status) return this;

    return NProgress.inc(0.3 + 0.5 * Math.random()).set(1);
  };

  /**
   * Increments by a random amount.
   */

  NProgress.inc = function(amount) {
    var n = NProgress.status;

    if (!n) {
      return NProgress.start();
    } else if(n > 1) {
      return;
    } else {
      if (typeof amount !== 'number') {
        if (n >= 0 && n < 0.25) {
          // Start out between 3 - 6% increments
          amount = (Math.random() * (5 - 3 + 1) + 3) / 100;
        } else if (n >= 0.25 && n < 0.65) {
          // increment between 0 - 3%
          amount = (Math.random() * 3) / 100;
        } else if (n >= 0.65 && n < 0.9) {
          // increment between 0 - 2%
          amount = (Math.random() * 2) / 100;
        } else if (n >= 0.9 && n < 0.99) {
          // finally, increment it .5 %
          amount = 0.005;
        } else {
          // after 99%, don't increment:
          amount = 0;
        }
      }

      n = clamp(n + amount, 0, 0.994);
      return NProgress.set(n);
    }
  };

  NProgress.trickle = function() {
    return NProgress.inc();
  };

  /**
   * Waits for all supplied jQuery promises and
   * increases the progress as the promises resolve.
   *
   * @param $promise jQUery Promise
   */
  (function() {
    var initial = 0, current = 0;

    NProgress.promise = function($promise) {
      if (!$promise || $promise.state() === "resolved") {
        return this;
      }

      if (current === 0) {
        NProgress.start();
      }

      initial++;
      current++;

      $promise.always(function() {
        current--;
        if (current === 0) {
            initial = 0;
            NProgress.done();
        } else {
            NProgress.set((initial - current) / initial);
        }
      });

      return this;
    };

  })();

  /**
   * (Internal) renders the progress bar markup based on the `template`
   * setting.
   */

  NProgress.render = function(fromStart) {
    if (NProgress.isRendered()) return document.getElementById('nprogress');

    addClass(document.documentElement, 'nprogress-busy');

    var progress = document.createElement('div');
    progress.id = 'nprogress';
    progress.innerHTML = Settings.template;

    var bar      = progress.querySelector(Settings.barSelector),
        perc     = fromStart ? '-100' : toBarPerc(NProgress.status || 0),
        parent   = document.querySelector(Settings.parent),
        spinner;

    css(bar, {
      transition: 'all 0s linear',
      transform: 'translate3d(' + perc + '%,0,0)'
    });

    if (!Settings.showSpinner) {
      spinner = progress.querySelector(Settings.spinnerSelector);
      spinner && removeElement(spinner);
    }

    if (parent != document.body) {
      addClass(parent, 'nprogress-custom-parent');
    }

    parent.appendChild(progress);
    return progress;
  };

  /**
   * Removes the element. Opposite of render().
   */

  NProgress.remove = function() {
    removeClass(document.documentElement, 'nprogress-busy');
    removeClass(document.querySelector(Settings.parent), 'nprogress-custom-parent');
    var progress = document.getElementById('nprogress');
    progress && removeElement(progress);
  };

  /**
   * Checks if the progress bar is rendered.
   */

  NProgress.isRendered = function() {
    return !!document.getElementById('nprogress');
  };

  /**
   * Determine which positioning CSS rule to use.
   */

  NProgress.getPositioningCSS = function() {
    // Sniff on document.body.style
    var bodyStyle = document.body.style;

    // Sniff prefixes
    var vendorPrefix = ('WebkitTransform' in bodyStyle) ? 'Webkit' :
                       ('MozTransform' in bodyStyle) ? 'Moz' :
                       ('msTransform' in bodyStyle) ? 'ms' :
                       ('OTransform' in bodyStyle) ? 'O' : '';

    if (vendorPrefix + 'Perspective' in bodyStyle) {
      // Modern browsers with 3D support, e.g. Webkit, IE10
      return 'translate3d';
    } else if (vendorPrefix + 'Transform' in bodyStyle) {
      // Browsers without 3D support, e.g. IE9
      return 'translate';
    } else {
      // Browsers without translate() support, e.g. IE7-8
      return 'margin';
    }
  };

  /**
   * Helpers
   */

  function clamp(n, min, max) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  /**
   * (Internal) converts a percentage (`0..1`) to a bar translateX
   * percentage (`-100%..0%`).
   */

  function toBarPerc(n) {
    return (-1 + n) * 100;
  }


  /**
   * (Internal) returns the correct CSS for changing the bar's
   * position given an n percentage, and speed and ease from Settings
   */

  function barPositionCSS(n, speed, ease) {
    var barCSS;

    if (Settings.positionUsing === 'translate3d') {
      barCSS = { transform: 'translate3d('+toBarPerc(n)+'%,0,0)' };
    } else if (Settings.positionUsing === 'translate') {
      barCSS = { transform: 'translate('+toBarPerc(n)+'%,0)' };
    } else {
      barCSS = { 'margin-left': toBarPerc(n)+'%' };
    }

    barCSS.transition = 'all '+speed+'ms '+ease;

    return barCSS;
  }

  /**
   * (Internal) Queues a function to be executed.
   */

  var queue = (function() {
    var pending = [];

    function next() {
      var fn = pending.shift();
      if (fn) {
        fn(next);
      }
    }

    return function(fn) {
      pending.push(fn);
      if (pending.length == 1) next();
    };
  })();

  /**
   * (Internal) Applies css properties to an element, similar to the jQuery
   * css method.
   *
   * While this helper does assist with vendor prefixed property names, it
   * does not perform any manipulation of values prior to setting styles.
   */

  var css = (function() {
    var cssPrefixes = [ 'Webkit', 'O', 'Moz', 'ms' ],
        cssProps    = {};

    function camelCase(string) {
      return string.replace(/^-ms-/, 'ms-').replace(/-([\da-z])/gi, function(match, letter) {
        return letter.toUpperCase();
      });
    }

    function getVendorProp(name) {
      var style = document.body.style;
      if (name in style) return name;

      var i = cssPrefixes.length,
          capName = name.charAt(0).toUpperCase() + name.slice(1),
          vendorName;
      while (i--) {
        vendorName = cssPrefixes[i] + capName;
        if (vendorName in style) return vendorName;
      }

      return name;
    }

    function getStyleProp(name) {
      name = camelCase(name);
      return cssProps[name] || (cssProps[name] = getVendorProp(name));
    }

    function applyCss(element, prop, value) {
      prop = getStyleProp(prop);
      element.style[prop] = value;
    }

    return function(element, properties) {
      var args = arguments,
          prop,
          value;

      if (args.length == 2) {
        for (prop in properties) {
          value = properties[prop];
          if (value !== undefined && properties.hasOwnProperty(prop)) applyCss(element, prop, value);
        }
      } else {
        applyCss(element, args[1], args[2]);
      }
    }
  })();

  /**
   * (Internal) Determines if an element or space separated list of class names contains a class name.
   */

  function hasClass(element, name) {
    var list = typeof element == 'string' ? element : classList(element);
    return list.indexOf(' ' + name + ' ') >= 0;
  }

  /**
   * (Internal) Adds a class to an element.
   */

  function addClass(element, name) {
    var oldList = classList(element),
        newList = oldList + name;

    if (hasClass(oldList, name)) return;

    // Trim the opening space.
    element.className = newList.substring(1);
  }

  /**
   * (Internal) Removes a class from an element.
   */

  function removeClass(element, name) {
    var oldList = classList(element),
        newList;

    if (!hasClass(element, name)) return;

    // Replace the class name.
    newList = oldList.replace(' ' + name + ' ', ' ');

    // Trim the opening and closing spaces.
    element.className = newList.substring(1, newList.length - 1);
  }

  /**
   * (Internal) Gets a space separated list of the class names on the element.
   * The list is wrapped with a single space on each end to facilitate finding
   * matches within the list.
   */

  function classList(element) {
    return (' ' + (element && element.className || '') + ' ').replace(/\s+/gi, ' ');
  }

  /**
   * (Internal) Removes an element from the DOM.
   */

  function removeElement(element) {
    element && element.parentNode && element.parentNode.removeChild(element);
  }

  return NProgress;
});
;
/*
* Unu Images
* 2016 04 - GLG
* 2016 08 - GLG version sur attributs distinct du checkload et ajout group-range
*
* What we do
* en fonction des attributs 
*   data-unuimages-range
*   data-unuimages-group-range
* conversion :
*   data-unuimages-style -> style
*   data-unuimages-src -> src
* Attention attribut cible écrasé  
*
*/

(function ($) {

  console.log('Load UI / Unu Images');

  /*
  * Base
  */  
  UnuImages = function() {
  }  

  /*
  * Activation des images dans le périmètre <selector> en fonction du range ou group_range
  */
  UnuImages.activer_images = function(selector) {
    _ = this;
    var current_range = $('body').attr('data-mqsync-range');
    var current_group_range = $('body').attr('data-mqsync-group-range');    
    console.log('UI Activating images group range : '+current_group_range+' or range : '+current_range);
    // activation attr style
    $(selector).find('[data-unuimages-style]').each(function() {
      var load_range = $(this).attr('data-unuimages-range');
      var load_group_range = $(this).attr('data-unuimages-group-range');
      if (load_group_range==current_group_range || load_range==current_range) {
        var attr_style = $(this).attr('data-unuimages-style');
        console.log('UI Activating style : '+attr_style);
        $(this).attr('style',attr_style);
        $(this).addClass('unuimages-style-activated');
        $(this).removeAttr('data-unuimages-style');
      }    
    });
    // activation attr src (marche pas bien sur certains browsers, à améliorer)
    /* $(selector).find('[data-unuimages-src]').each(function() {
      var load_range = $(this).attr('data-unuimages-range');
      var load_group_range = $(this).attr('data-unuimages-group-range');
      if (load_group_range==current_group_range || load_range==current_range) {
        var attr_src = $(this).attr('data-unuimages-src');
        console.log('UI Activating src : '+attr_src);
        $(this).attr('src',attr_src);
        $(this).addClass('unuimages-src-activated');
        $(this).removeAttr('data-unuimages-src');
      }    
    }); */    
  } 
  
})(jQuery);;
/*
* Unu Appa
* 2016 08 - GLG
*
* What we do
* Gestion de l'apparition au scroll des éléments (pure affichage, pas de load progressif)
*
*/

(function ($) {

  console.log('Load UA / Unu Appa');

  /*
  * Base
  */  
  UnuAppa = function() {
  }  
  
  /*
  * Application des classes de masquage
  * selector : selecteur jquery des objets à gérer
  * mintop : offset minimal
  */
  UnuAppa.prepare = function(context, selector, mintop) {
    _ = this;
    //console.log('UA : prepare on '+selector);
    $(context).find(selector).not('.ua-enabled').each(function() {      
      //console.log('UA prepare on elem');
      var t = $(this).offset().top;
      //console.log(t)
      if (t>=mintop) {
        $(this).addClass('ua-enabled').addClass('ua-hide');
      }    
    });    
  } 
  
  /*
  * Preparation standard sur tous les éléments applicables
  */
  UnuAppa.prepareAll = function(context, mintop) {
    _ = this;
    var selector = "div.node-real.node-teaser";
    selector+= ", div.node-projet.node-teaser";
    selector+= ", div.node-real.node-teaser_nb";
    selector+= ", div.projet-awards ul.awards";
    selector+= ", div.node-news.node-teaser";
    selector+= ", div.node-award.node-teaser";
    _.prepare(context, selector, mintop);  
  }
  
  /*
  * Apparition des elements
  * full : force tous les elements
  */
  UnuAppa.update = function(full, perimeter) {
    _ = this;
    
    //console.log('UA update : '+full+'/'+perimeter);
    
    var marge_display=100; // marge position element avant apparition en bas du vp
    var max_delay=200; // delay increment max de retard apparition
    
    var st = $(window).scrollTop();
    var vh = $(window).height();
    
    var delay_app = 0;
    
    $(perimeter).find('.ua-hide').not('.ua-willshow').each(function() {
      var t = $(this).offset().top;
      if( full || t < (st+vh-marge_display) ) {
        var $elem = $(this);
        $elem.addClass('ua-willshow');        
        setTimeout(function() {
          $elem.removeClass('ua-hide');
        }, delay_app);
        delay_app += Math.floor(Math.random() * max_delay);
      }
      else {
        // si element au delà du bas du vp, les suivants le seront aussi
        return;
      }        
    });
  }
  
})(jQuery);;
/*
* Unu Parallaxe
* 2016 09 - GLG
*
* What we do :
* simple effet de parallaxe sur element relativement à leur container
*
*/

(function ($) {

  console.log('Load UPX / Unu Parallaxe');

  /*
  * Base
  */  
  UnuParallaxe = function() {
  }
  
  UnuParallaxe.perimeter = '#q_body';

  /*
  * Init
  * set initial elm position (to be called on ready)
  */
  UnuParallaxe.init = function() {  
    $(UnuParallaxe.perimeter).find('div.upx-enabled').each(function() {
      var pb = $(this).parent()[0].getBoundingClientRect();
      var ob = this.getBoundingClientRect();      
      console.log('UPX init element');
      //console.log(pb.height+' - '+ob.height);      
      var y = Math.round((pb.height - ob.height) / 2, 3);
      $(this).css('transform','translateY('+y+'px) scale(1.15)');
    });
  }
  
  /*
  * Update
  * set parallaxe elm position (to be called ons scroll event)
  */
  UnuParallaxe.update = function() {
    
    //console.log('UPX update');

    var vh = $(window).height();    
    
    $(UnuParallaxe.perimeter).find('div.upx-enabled').each(function() {
      
      var pb = $(this).parent()[0].getBoundingClientRect();
      var ob = this.getBoundingClientRect();
      
      // test if parent visible
      if (pb.top < vh && pb.top > -pb.height) {        
        // cal position        
        if ($(this).hasClass('upx-effect1')) // parallaxe pour parents qui traversent le vp
          var y = (pb.height - ob.height) * (-0.5 + (pb.top - (-pb.height)) / (vh - (-pb.height)));
        else if ($(this).hasClass('upx-effect2')) // parallaxe pour parents déjà en haut de vp (covers par exemple)
          var y = (pb.height - ob.height) * (-0.5 + (pb.top - (-pb.height)) / (pb.height));       
        // prevent hors limite (scroll durant anim de transition qui déclenche un update... ?)
        y = Math.round(Math.max(y,(pb.height - ob.height) / 2), 3);
        // set position
        $(this).css('transform','translateY('+y+'px) scale(1.15)'); // ordre important (la tranlation se fait dans le référentiel de l'objet !) 
      }
    });    
  }
  
})(jQuery);;
/*
* Unu Checkload
* 2016 09 - GLG
*
* What we do :
* Trigger d'un event donné en paramètre après avoir vérifié le chargement d'un certain nombre d'objets (images notamment)
*
*/

(function ($) {

  console.log('Load UCL / Unu Check Load');

  /*
  * Base
  */  
  UnuCheckload = function() {
  }  
  
  /*
  * Check content load
  * selector : perimetre des objets
  * event_name : nom de l'event une fois les elements chargés
  * event_infos : data lié à l'event
  *
  *
  */
  UnuCheckload.check = function(selector, event_name, event_infos, max_load_img, max_load_bg_img) {
    _ = this;
    
    // Content fully loaded detection
    var to_load_collection = $();
    var count_img = 0;
    var count_bg_img = 0;
    // Collects Div background images
    $(selector).find('div').filter(function() {
        return ( $(this).css('background-image') !== 'none' );
    }).each(function() {
      var img_url = $(this).css('background-image').slice(4, -1).replace(/"/g, "");
      var checkload_bypass = $(this).attr('data-checkload-bypass');
      if (checkload_bypass == 'bypass') {
        console.log('UCL Bypass Check Load BG image :'+img_url);
      }
      else if (count_bg_img >= max_load_bg_img) {
        console.log('UCL Max Preload Items count reached for BG image :'+img_url);
      }
      else {
        console.log('UCL Found Check Load BG image :'+img_url);
        to_load_collection.push( $('<img src="'+img_url+'" />') );
        count_bg_img++;
      }
    });      
    // Collects Images
    $(selector).find('img').each(function() {
      var checkload_bypass = $(this).attr('data-checkload-bypass');
      if (checkload_bypass == 'bypass') {
        console.log('UCL Bypass Check Load NORMAL image :'+($(this)[0].src));
      }
      else if (count_img >= max_load_img) {
        console.log('UCL Max Preload Items count reached for NORMAL image :'+($(this)[0].src));
      }
      else {
        console.log('UCL Found Check Load NORMAL image :'+($(this)[0].src));
        to_load_collection.push( $('<img src="'+($(this)[0].src)+'" />') );
        count_img++;
      }
    });
    // Nb total
    var nb_to_load = to_load_collection.length;
    console.log('UCL Objects to wait to load : '+nb_to_load);
    var nb_loaded = 0;
    function checkDone() {
      console.log('UCL : '+nb_loaded+' / '+nb_to_load);
      //NProgress.set(nb_loaded/nb_to_load);
      NProgress.inc();
      if ( nb_loaded == nb_to_load ) {
        // Finalisation loader
        NProgress.done();
        // reset flag that will allow new ajax api load
        if (typeof AjaxLinksApi != 'undefined')
          AjaxLinksApi.loading = false;
        // Event to inform about the end of load
        //timer pour éviter certains pb dans FF qui n'est pas encore prêt et reporte de mauvaises taille (sans prise en compte des marges !!!)
        //setTimeout(function() {
          console.log('UCL event : '+event_name);
          $(window).trigger( event_name, event_infos );
        //},300);
      }
    }
    to_load_collection.each(function() {
      if (this.complete) {
          nb_loaded++;
      } else {
        $(this)
        .on('load.ucl_event',function(){
          nb_loaded++;
          checkDone();
        })
        .on('error.ucl_event',function(){
          console.log('UCL Error loading');
          nb_loaded++;
          checkDone();
        });
      }
    });
    checkDone();

      
  }
  
  
  
  
})(jQuery);;
/*! npm.im/iphone-inline-video */
var makeVideoPlayableInline=function(){"use strict";function e(e){function r(t){n=requestAnimationFrame(r),e(t-(i||t)),i=t}var n,i;this.start=function(){n||r(0)},this.stop=function(){cancelAnimationFrame(n),n=null,i=0}}function r(e,r,n,i){function t(r){Boolean(e[n])===Boolean(i)&&r.stopImmediatePropagation(),delete e[n]}return e.addEventListener(r,t,!1),t}function n(e,r,n,i){function t(){return n[r]}function d(e){n[r]=e}i&&d(e[r]),Object.defineProperty(e,r,{get:t,set:d})}function i(e,r,n){n.addEventListener(r,function(){return e.dispatchEvent(new Event(r))})}function t(e,r){Promise.resolve().then(function(){e.dispatchEvent(new Event(r))})}function d(e){var r=new Audio;return i(e,"play",r),i(e,"playing",r),i(e,"pause",r),r.crossOrigin=e.crossOrigin,r.src=e.src||e.currentSrc||"data:",r}function a(e,r,n){(f||0)+200<Date.now()&&(e[h]=!0,f=Date.now()),n||(e.currentTime=r),T[++w%3]=100*r|0}function o(e){return e.driver.currentTime>=e.video.duration}function u(e){var r=this;r.video.readyState>=r.video.HAVE_FUTURE_DATA?(r.hasAudio||(r.driver.currentTime=r.video.currentTime+e*r.video.playbackRate/1e3,r.video.loop&&o(r)&&(r.driver.currentTime=0)),a(r.video,r.driver.currentTime)):r.video.networkState!==r.video.NETWORK_IDLE||r.video.buffered.length||r.video.load(),r.video.ended&&(delete r.video[h],r.video.pause(!0))}function s(){var e=this,r=e[g];return e.webkitDisplayingFullscreen?void e[b]():("data:"!==r.driver.src&&r.driver.src!==e.src&&(a(e,0,!0),r.driver.src=e.src),void(e.paused&&(r.paused=!1,e.buffered.length||e.load(),r.driver.play(),r.updater.start(),r.hasAudio||(t(e,"play"),r.video.readyState>=r.video.HAVE_ENOUGH_DATA&&t(e,"playing")))))}function c(e){var r=this,n=r[g];n.driver.pause(),n.updater.stop(),r.webkitDisplayingFullscreen&&r[E](),n.paused&&!e||(n.paused=!0,n.hasAudio||t(r,"pause"),r.ended&&(r[h]=!0,t(r,"ended")))}function v(r,n){var i=r[g]={};i.paused=!0,i.hasAudio=n,i.video=r,i.updater=new e(u.bind(i)),n?i.driver=d(r):(r.addEventListener("canplay",function(){r.paused||t(r,"playing")}),i.driver={src:r.src||r.currentSrc||"data:",muted:!0,paused:!0,pause:function(){i.driver.paused=!0},play:function(){i.driver.paused=!1,o(i)&&a(r,0)},get ended(){return o(i)}}),r.addEventListener("emptied",function(){var e=!i.driver.src||"data:"===i.driver.src;i.driver.src&&i.driver.src!==r.src&&(a(r,0,!0),i.driver.src=r.src,e?i.driver.play():i.updater.stop())},!1),r.addEventListener("webkitbeginfullscreen",function(){r.paused?n&&!i.driver.buffered.length&&i.driver.load():(r.pause(),r[b]())}),n&&(r.addEventListener("webkitendfullscreen",function(){i.driver.currentTime=r.currentTime}),r.addEventListener("seeking",function(){T.indexOf(100*r.currentTime|0)<0&&(i.driver.currentTime=r.currentTime)}))}function p(e){var i=e[g];e[b]=e.play,e[E]=e.pause,e.play=s,e.pause=c,n(e,"paused",i.driver),n(e,"muted",i.driver,!0),n(e,"playbackRate",i.driver,!0),n(e,"ended",i.driver),n(e,"loop",i.driver,!0),r(e,"seeking"),r(e,"seeked"),r(e,"timeupdate",h,!1),r(e,"ended",h,!1)}function l(e,r,n){void 0===r&&(r=!0),void 0===n&&(n=!0),n&&!y||e[g]||(v(e,r),p(e),e.classList.add("IIV"),!r&&e.autoplay&&e.play(),"MacIntel"!==navigator.platform&&"Windows"!==navigator.platform||console.warn("iphone-inline-video is not guaranteed to work in emulated environments"))}var f,m="undefined"==typeof Symbol?function(e){return"@"+(e||"@")+Math.random()}:Symbol,y=/iPhone|iPod/i.test(navigator.userAgent)&&void 0===document.head.style.grid,g=m(),h=m(),b=m("nativeplay"),E=m("nativepause"),T=[],w=0;return l.isWhitelisted=y,l}();;
/*
* Quad
* js global quad dispatch
* GLG - 2016 09
*/

// Console disable en prod
/* (function () {
    var method;
    var noop = function noop() { };
    var methods = [
    'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
    'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
    'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
    'timeStamp', 'trace', 'warn'
    ];
    var length = methods.length;
    var console = (window.console = window.console || {});

    while (length--) {
        method = methods[length];
        console[method] = noop;
    }
}()); */


(function ($) {
  // Ensure we init once
  $('html').once('quad_dispatch_global', function () {

    console.log('Init quad_dispatch_global');

    /*
    * Base.
    */

    //...


    /*
    *  Mqsync events
    */
    $(window).on( "mqsync.ev_quad_dispatch_global", function( event, mqs_data ) {

      // Debug MqSync
      console.log(mqs_data);

      //***
      // Ready
      if (mqs_data.base_event == 'ready') {

        // Loader
        NProgress.configure({ 
          trickleRate: 0.005, 
          trickleSpeed:600,
          trickle: true,
          showSpinner: false,
          easing: 'ease', 
          speed: 500,
          parent: '#page',
        });    
        NProgress.start();        

      }

      //***
      // Ajax page Ready
      if (mqs_data.group_range == 'desktop' && mqs_data.base_event == 'ajax_links_api_ready') {

        // Init UPX elm positions
        UnuParallaxe.init();

        // Checkload
        UnuCheckload.check(Drupal.settings.ajax_links_api.selector, 'ajax_links_api_load', [], 30, 30 );        
      }
      else if (mqs_data.group_range == 'mobile' && mqs_data.base_event == 'ajax_links_api_ready') {

        // Checkload
        UnuCheckload.check(Drupal.settings.ajax_links_api.selector, 'ajax_links_api_load', [], 0, 0 );
      }      

      //***
      // Init ou passage au Desktop
      if ( mqs_data.group_range == 'desktop' && mqs_data.base_event == 'ready'
        || mqs_data.group_range == 'desktop' && mqs_data.group_type == 'newrange' )
      {

        // Nettoyage
        if ( mqs_data.group_range_previous == 'mobile' )
        {
          // unbind events
          $( "body, body *" ).off('.ev_quad_dispatch_global_mobile');
          $( window ).off('.ev_quad_dispatch_global_mobile');
        }

        // Activation des images selon le range
        UnuImages.activer_images('#page');
        
        // Init UPX elm positions
        UnuParallaxe.init();

        // Apparition elements au scroll
        // & Parallaxe effects
        $(window).on('scroll.ev_quad_dispatch_global_desktop',function() {
          UnuParallaxe.update();
          UnuAppa.update(false, 'body');
        });
        // pour le cas aller retour : desktop -> mobile -> scroll down -> desktop
        if (mqs_data.group_type == 'newrange') {
          UnuAppa.update(false, 'body');
        }
        
        // Roll sur liste d'items
        $('body').on('mouseenter.ev_quad_dispatch_global_desktop','div.node-news div.news_visuel', function() {
          $(this).parent().parent().parent().addClass('hover_item');
        });
        $('body').on('mouseleave.ev_quad_dispatch_global_desktop','div.node-news div.news_visuel', function() {
          $(this).parent().parent().parent().removeClass('hover_item');
        }); 
       
        // CheckLoad
        if (mqs_data.base_event == 'ready')
          UnuCheckload.check('body','direct_page_content_load',[],30,30);

      }
      //***
      // Init ou passage au Mobile
      else if ( mqs_data.group_range == 'mobile' && mqs_data.base_event == 'ready'
             || mqs_data.group_range == 'mobile' && mqs_data.group_type == 'newrange' )
      {

        // Nettoyage
        if ( mqs_data.group_range_previous == 'desktop' )
        {
          // unbind events
          $( "body, body *" ).off('.ev_quad_dispatch_global_desktop');
          $( window ).off('.ev_quad_dispatch_global_desktop');
        }

        // Activation des images selon le range
        UnuImages.activer_images('#page');
        
        // CheckLoad
        if (mqs_data.base_event == 'ready')
          UnuCheckload.check('body','direct_page_content_load',[],0,0);

      }

      //***
      // Direct page Load ou Ajax Load
      if (mqs_data.base_event == 'direct_page_content_load'
       || mqs_data.base_event == 'ajax_links_api_load') {
        
        // desktop onload stuff
        if ( mqs_data.group_range == 'desktop') {          
          // Preparation anim apparition éléments, desktop only
          UnuAppa.prepareAll('body', $(window).height() + $(window).scrollTop());         
        }

        // ingoing transition
        setTimeout(function() {
          $('#page').addClass('show_q_body');
        },1000);

      }
 
    }); // end mqsync event

    /*
    * Fonctions
    */

    //...



  });




  /*
   * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
   *
   * Uses the built in easing capabilities added In jQuery 1.1
   * to offer multiple easing options
   *
   * TERMS OF USE - jQuery Easing
   *
   * Open source under the BSD License.
   *
   * Copyright 2008 George McGinley Smith
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without modification,
   * are permitted provided that the following conditions are met:
   *
   * Redistributions of source code must retain the above copyright notice, this list of
   * conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above copyright notice, this list
   * of conditions and the following disclaimer in the documentation and/or other materials
   * provided with the distribution.
   *
   * Neither the name of the author nor the names of contributors may be used to endorse
   * or promote products derived from this software without specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
   * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
   * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
   * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
   * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
   * OF THE POSSIBILITY OF SUCH DAMAGE.
   *
  */

  // t: current time, b: begInnIng value, c: change In value, d: duration
  $.easing.jswing = $.easing.swing;

  $.extend($.easing,
  {
      def: 'easeOutQuad',
      swing: function (x, t, b, c, d) {
          //alert($.easing.default);
          return $.easing[$.easing.def](x, t, b, c, d);
      },
      easeInQuad: function (x, t, b, c, d) {
          return c*(t/=d)*t + b;
      },
      easeOutQuad: function (x, t, b, c, d) {
          return -c *(t/=d)*(t-2) + b;
      },
      easeInOutQuad: function (x, t, b, c, d) {
          if ((t/=d/2) < 1) return c/2*t*t + b;
          return -c/2 * ((--t)*(t-2) - 1) + b;
      },
      easeInCubic: function (x, t, b, c, d) {
          return c*(t/=d)*t*t + b;
      },
      easeOutCubic: function (x, t, b, c, d) {
          return c*((t=t/d-1)*t*t + 1) + b;
      },
      easeInOutCubic: function (x, t, b, c, d) {
          if ((t/=d/2) < 1) return c/2*t*t*t + b;
          return c/2*((t-=2)*t*t + 2) + b;
      },
      easeInQuart: function (x, t, b, c, d) {
          return c*(t/=d)*t*t*t + b;
      },
      easeOutQuart: function (x, t, b, c, d) {
          return -c * ((t=t/d-1)*t*t*t - 1) + b;
      },
      easeInOutQuart: function (x, t, b, c, d) {
          if ((t/=d/2) < 1) return c/2*t*t*t*t + b;
          return -c/2 * ((t-=2)*t*t*t - 2) + b;
      },
      easeInQuint: function (x, t, b, c, d) {
          return c*(t/=d)*t*t*t*t + b;
      },
      easeOutQuint: function (x, t, b, c, d) {
          return c*((t=t/d-1)*t*t*t*t + 1) + b;
      },
      easeInOutQuint: function (x, t, b, c, d) {
          if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
          return c/2*((t-=2)*t*t*t*t + 2) + b;
      },
      easeInSine: function (x, t, b, c, d) {
          return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
      },
      easeOutSine: function (x, t, b, c, d) {
          return c * Math.sin(t/d * (Math.PI/2)) + b;
      },
      easeInOutSine: function (x, t, b, c, d) {
          return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
      },
      easeInExpo: function (x, t, b, c, d) {
          return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
      },
      easeOutExpo: function (x, t, b, c, d) {
          return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
      },
      easeInOutExpo: function (x, t, b, c, d) {
          if (t==0) return b;
          if (t==d) return b+c;
          if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
          return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
      },
      easeInCirc: function (x, t, b, c, d) {
          return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;
      },
      easeOutCirc: function (x, t, b, c, d) {
          return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
      },
      easeInOutCirc: function (x, t, b, c, d) {
          if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
          return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
      },
      easeInElastic: function (x, t, b, c, d) {
          var s=1.70158;var p=0;var a=c;
          if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
          if (a < Math.abs(c)) { a=c; var s=p/4; }
          else var s = p/(2*Math.PI) * Math.asin (c/a);
          return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
      },
      easeOutElastic: function (x, t, b, c, d) {
          var s=1.70158;var p=0;var a=c;
          if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
          if (a < Math.abs(c)) { a=c; var s=p/4; }
          else var s = p/(2*Math.PI) * Math.asin (c/a);
          return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
      },
      easeInOutElastic: function (x, t, b, c, d) {
          var s=1.70158;var p=0;var a=c;
          if (t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);
          if (a < Math.abs(c)) { a=c; var s=p/4; }
          else var s = p/(2*Math.PI) * Math.asin (c/a);
          if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
          return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;
      },
      easeInBack: function (x, t, b, c, d, s) {
          if (s == undefined) s = 1.70158;
          return c*(t/=d)*t*((s+1)*t - s) + b;
      },
      easeOutBack: function (x, t, b, c, d, s) {
          if (s == undefined) s = 1.70158;
          return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
      },
      easeInOutBack: function (x, t, b, c, d, s) {
          if (s == undefined) s = 1.70158;
          if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
          return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
      },
      easeInBounce: function (x, t, b, c, d) {
          return c - $.easing.easeOutBounce (x, d-t, 0, c, d) + b;
      },
      easeOutBounce: function (x, t, b, c, d) {
          if ((t/=d) < (1/2.75)) {
              return c*(7.5625*t*t) + b;
          } else if (t < (2/2.75)) {
              return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
          } else if (t < (2.5/2.75)) {
              return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
          } else {
              return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
          }
      },
      easeInOutBounce: function (x, t, b, c, d) {
          if (t < d/2) return $.easing.easeInBounce (x, t*2, 0, c, d) * .5 + b;
          return $.easing.easeOutBounce (x, t*2-d, 0, c, d) * .5 + c*.5 + b;
      }
  });

  /*
   *
   * TERMS OF USE - EASING EQUATIONS
   *
   * Open source under the BSD License.
   *
   * Copyright 2001 Robert Penner
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without modification,
   * are permitted provided that the following conditions are met:
   *
   * Redistributions of source code must retain the above copyright notice, this list of
   * conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above copyright notice, this list
   * of conditions and the following disclaimer in the documentation and/or other materials
   * provided with the distribution.
   *
   * Neither the name of the author nor the names of contributors may be used to endorse
   * or promote products derived from this software without specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
   * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
   * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
   * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
   * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
   * OF THE POSSIBILITY OF SUCH DAMAGE.
   *
   */


})(jQuery);;
/*
* Unutsi
* MQ Sync / Responsive Base Stuff
* 2016 02 - GLG
* 2016 07 - ajout group range et infos dans objet
*/

// base from http://brettjankord.com/2012/11/15/syncing-javascript-with-your-active-media-query/

(function ($) {
  
  // Ensure we init mqsync once
  $('html').once('unu_mqsync', function () {
  
    console.log('Load MQS / Media Query Sync');
   
    // Add Events Cross-browser
    /*var event = {
      add: function(elem, type, fn) {
        if (elem.attachEvent) {
          elem['e'+type+fn] = fn;
          elem[type+fn] = function() {elem['e'+type+fn](window.event);}
          elem.attachEvent('on'+type, elem[type+fn]);
        } else
        elem.addEventListener(type, fn, false);
      }
    };*/  
    
    // range groups
    var range_groups = {
      S: 'mobile',
      L: 'desktop',
      XL: 'desktop',
      XXL: 'desktop',
      XXXL: 'desktop'
    }

    // Set default
    var currentMQ = "unknown";
    var currentMQgroup = "unknown";

    // Checks CSS value in active media query and syncs Javascript functionality
    var mqSync = function(base_event, base_event_data){

      //console.log('MQS Base event : '+base_event)
    
      // Get active MQ
      // Fix for Opera issue when using font-family to store value
      if (window.opera){
        var activeMQ = window.getComputedStyle(document.body,':after').getPropertyValue('content');
      }
      // For all other modern browsers
      else if (window.getComputedStyle) 
      {
        var activeMQ = window.getComputedStyle(document.head,null).getPropertyValue('font-family');
      }
      // For oldIE
      else {
        // Use .getCompStyle instead of .getComputedStyle so above check for window.getComputedStyle never fires true for old browsers
        window.getCompStyle = function(el, pseudo) {
          this.el = el;
          this.getPropertyValue = function(prop) {
            var re = /(\-([a-z]){1})/g;
            if (prop == 'float') prop = 'styleFloat';
            if (re.test(prop)) {
              prop = prop.replace(re, function () {
                return arguments[2].toUpperCase();
              });
            }
            return el.currentStyle[prop] ? el.currentStyle[prop] : null;
          }
          return this;
        }
        var compStyle = window.getCompStyle(document.getElementsByTagName('head')[0], "");
        var activeMQ = compStyle.getPropertyValue("font-family");
      }      
      activeMQ = activeMQ.replace(/"/g, "");
      activeMQ = activeMQ.replace(/'/g, "");
      
      // Get active MQ Group
      activeMQgroup = range_groups[activeMQ];
       
      // Event data init
      var mqs_data = {
        base_event : base_event,
        type : 'NA',
        range : activeMQ,
        range_previous : currentMQ,
        group_type : 'NA',
        group_range : activeMQgroup,
        group_range_previous : currentMQgroup,
        base_event_data: base_event_data,
      };
      
      // prepare event data
      if (activeMQ != currentMQ) {
        if (currentMQ == 'unknown') 
        {
          // This is the first init
          mqs_data.type = "init";
          mqs_data.group_type = "init";
        }
        else
        {
          // A resize with range change
          mqs_data.type = "newrange";
          if (activeMQgroup != currentMQgroup) {
            // A resize with range group change
            mqs_data.group_type = "newrange";
          }
          else {
            // same group range
            mqs_data.group_type = "samerange";
          }
        }  
        currentMQ = activeMQ;
        currentMQgroup = activeMQgroup;
        $('body').attr('data-mqsync-range',activeMQ);
        $('body').attr('data-mqsync-group-range',activeMQgroup);
      }
      else {
        // Simple resize without range change
        mqs_data.type = "samerange";
        mqs_data.group_type = "samerange";
      }     
      
      // Trigger event
      $(window).trigger( "mqsync", [ mqs_data ] );
      
    }; // End mqSync
    
    
    /*
    * Catchs events to then trigger a new event on the window object but with mqsync infos
    */

    // Run on doc Ready -> will trigger a mqsync event on window
    $( document ).ready(function() {
      mqSync('ready', null);
    });
    
    // Run on Load -> will trigger a mqsync event on window
    $(window).load(function() {
      mqSync('load', null);
    }); 

    // Run on Resize -> will trigger a mqsync event on window
    /*event.add(window, "resize", mqSync);*/
    $( window ).resize(function() {
      mqSync('resize', null);
    }); 
    
    // Run on ajax start
    $( document ).ajaxStart(function() {
      mqSync('ajaxstart', null);
    });         
    
    // Run on ajax send
    $( document ).ajaxSend(function( event, jqxhr, settings ) {
      mqSync('ajaxsend', settings);
    });  
    
    // Run on ajax complete
    $( document ).ajaxComplete(function() {
      mqSync('ajaxcomplete', null);
    }); 

    // Run on ajax links api new page ready
    $( window ).on('ajax_links_api_ready', function(url) {
      mqSync('ajax_links_api_ready', null);
    });
    
    // Run on ajax links api content loaded
    $( window ).on('ajax_links_api_load', function(url) {
      mqSync('ajax_links_api_load', null);
    });
    
    // Run on new page content load
    $( window ).on('direct_page_content_load', function(url) {
      mqSync('direct_page_content_load', null);
    });    

    // Special : relay of flag module events
    $(document).bind('flagGlobalAfterLinkUpdate', function(event, data) {
      mqSync('flagGlobalAfterLinkUpdate', data);
    });
    
  });
  
})(jQuery);;
/*
* js spécifique content type page_home dispatch
* 2016 09 - GLG
*/

(function ($) {
  
  /*
  * Behaviors
  */   
  
	Drupal.behaviors.quad_page_home = {  
  
    detach: function () {
      console.log('detach quad_page_home ');
      // remove events
      $( "body, body *" ).off('.ev_page_home_desktop');
      $( "body, body *" ).off('.ev_page_home_mobile');
      $( window ).off('.ev_page_home');
      // delete behavior
      delete Drupal.behaviors.quad_page_home;
    },   
  
    attach:function(context) {
      $('body').once('quad_page_home', function () {  
  
        console.log('attach quad_page_home');
        
        var nb_entities = $('#entities div.node-entity').length;
        var gap_entites = 20; // gap de scroll entre entites en vh        
      
        var sr_timer;
        var video_sr;
        var txt1, txt2, txt1_new, txt2_new;        
        
        $(window).on( "mqsync.ev_page_home", function( event, mqs_data ) {
 
          // Gestion textes showreel
          function update_showreel_textes(ct) {            
            //console.log(ct);
            //console.log(Drupal.settings.showreel_page_home.textes);
            $(Drupal.settings.showreel_page_home.textes).each(function(idx,txt) {
              if (txt.pos <= ct) {
                //console.log(txt)
                txt1_new = txt.txt1;
                txt2_new = txt.txt2;
                return false;
              }
            });
            if (txt1_new != txt1) {
              txt1 = txt1_new;
              console.log(txt1)
              $('#showreel div.txt1_w').animate({
                left:'30%',
                opacity:0,
              }, 300, 'easeInOutCubic', function() {
                $('#showreel div.txt1').html(txt1);
                $('#showreel div.txt1_w').css('left','-30%');
                $('#showreel div.txt1_w').animate({
                  left:'0%',
                  opacity:1,
                }, 300, 'easeInOutCubic');                      
              });
            }
            if (txt2_new != txt2) {
              txt2 = txt2_new;  
              console.log(txt2)                    
              $('#showreel div.txt2_w').animate({
                left:'-30%',
                opacity:0,
              }, 300, 'easeInOutCubic', function() {
                $('#showreel div.txt2').html(txt2);
                $('#showreel div.txt2_w').css('left','30%');
                $('#showreel div.txt2_w').animate({
                  left:'0%',
                  opacity:1,
                }, 300, 'easeInOutCubic');                      
              });                      
            }
          }
          
          // toogle showreel desktop play selon position dans vp
          function toogle_showreel_play(range) {
            $('#showreel').each(function() {
              var bcr = $(this)[0].getBoundingClientRect();
              var vh = $(window).height();
              if (range=="desktop")
                var $video = $(this).find('video.sr_video_desk');
              else
                var $video = $(this).find('video.sr_video_mob.canplay');
              if ($video.length == 1) {
                if (bcr.top < vh && bcr.top > -bcr.height ) {
                  if ($video[0].paused) {                    
                    $video[0].currentTime = 0;
                    console.log('play sr')
                    $video[0].play();
                    video_sr = $video[0];   
                    update_showreel_textes(0);
                    sr_timer = setInterval(function() {
                      update_showreel_textes(video_sr.currentTime * 10); // calage au 1/10s
                    },200);                      
                  }
                }
                else {
                  clearInterval(sr_timer); 
                  txt1 = '';
                  txt2 = '';
                  $('#showreel div.txt1').html('');
                  $('#showreel div.txt2').html('');
                  if (!$video[0].paused) {
                    console.log('pause sr');                      
                    $video[0].pause(); 
                  }
                }
              }
            });
          }
          
          // toggle entity desktop video play selon class du node
          function toogle_videos_play_class() {
            var jumpmode = $('#entities').hasClass('scrolling'); // scroll via menu, on ne play pas les intermédiaires
            $('div.field-name-field-entities div.node-entity').each(function() {
              var $video = $(this).find('video');
              if ($video.length == 1) {
                if ( $(this).hasClass('visible') ) {
                  // en scroll via menu on ne déclenche un play que sur la target slide
                  if ($video[0].paused && (!jumpmode || $(this).hasClass('target')) ) {
                    console.log('play')
                    $video[0].play();    
                  }
                }
                else {
                  if (!$video[0].paused) {
                    console.log('pause');                      
                    $video[0].pause();   
                  }
                }
              }
            });
          }           
          
          // entity width
          function update_entity_width() {
            var vw = $(window).width();
            var mw = $('#menu_desk').width();
            $('#entities div.node-entity').css('width',Math.ceil(vw-mw)+'px');
          }

          // entity slide position
          function update_entity_position() {
            var vh = $(window).height();
            var th = $('body').height();
            var st = $(window).scrollTop();
            var avancee = st + vh - (th - (nb_entities)*vh - (nb_entities-1)*gap_entites*vh/100); // avancée de scroll à repartir
            //console.log(avancee);
            var active_idx = 0; // element de menu à rendre actif
            $('#entities div.node-entity').each(function(index) {
              if (avancee<=0) {
                // pas encore visible
                $(this).css('top','100vh');
                $(this).removeClass('visible');
              }
              else if (avancee >= vh) {
                // totalement up
                $(this).css('top',0);
                avancee -= vh;
                avancee -= vh * gap_entites / 100;
                if (avancee < vh) {
                  $(this).addClass('visible');
                  active_idx = index+1;
                }
                else
                  $(this).removeClass('visible');
              } 
              else {
                // partiellement visible
                $(this).css('top',Math.floor(vh-avancee)+'px');
                if (avancee>=vh/2)
                  active_idx = index+1;
                avancee = 0;
                $(this).addClass('visible');
              }
            });
            // set active menu item
            $('#menu_desk div.menu_item.active').not(':eq('+active_idx+')').removeClass('active'); 
            $('#menu_desk div.menu_item:eq('+active_idx+')').addClass('active'); 
          } 
          
          // menu desk sizing
          function update_menu_desk_size() {
            var count = 100 / $('#menu_desk div.menu_item').length;
            $('#menu_desk div.menu_item').css('height',count+'vh');
          }
          
          
          //*************
          // Init ou passage au Desktop
          if ( mqs_data.group_range == 'desktop' && mqs_data.base_event == 'ready'
            || mqs_data.group_range == 'desktop' && mqs_data.group_type == 'newrange' )
          {     

            // Nettoyage
            if ( mqs_data.group_range_previous == 'mobile' )
            {          
              // unbind desktop events
              $( "body, body *" ).off('.ev_page_home_mobile');
              $( window ).off('.ev_page_home_mobile');
              
              // stop showreel
              clearInterval(sr_timer); 
              $('#showreel video.sr_video_mob').each(function() {
                $(this)[0].pause();  
                $(this).removeClass('canplay');
              });              
              $('#showreel div.mobile_play_button').show(); 
              txt1 = '';
              txt2 = '';
              $('#showreel div.txt1').html('');
              $('#showreel div.txt2').html('');
            }

            // Entities init
            $('#entities_ghost').css('height',(nb_entities*100 + (nb_entities-1)*gap_entites )+'vh');
            update_entity_width();
            update_entity_position();
            toogle_videos_play_class();
            
            
            // showreel init
            toogle_showreel_play('desktop');
            
            // menu init
            update_menu_desk_size();
            
            // menu clic
            $('#menu_desk div.menu_item').on('click.ev_page_home_desktop', function() {
              // set item active
              //$('#menu_desk div.menu_item').removeClass('active'); 
              //$(this).addClass('active');             
              // calc scroll to
              var idx = $(this).index();
              var scrollTarget = 0;
              if (idx>0) {
                var vh = $(window).height();
                var th = $('body').height();              
                scrollTarget = th-vh-(nb_entities-idx)*(vh+gap_entites/100*vh);
              }
              // scroll prepare
              $('#entities').addClass('scrolling'); // inform scroll function about scrolling
              //$('#entities div.node-entity.visible').addClass('previous_visible'); // déjà visible
              $('#entities div.node-entity:eq('+(idx-1)+')').addClass('target'); // cible du scroll
              // scroll to
              $('html, body').animate({
                scrollTop:scrollTarget,
              }, 600, function() {
                $('#entities').removeClass('scrolling');
                $('#entities div.node-entity.target').removeClass('target');
                //$('#entities div.node-entity.previous_visible').removeClass('previous_visible');
              });
            });
            
            // desktop scroll
            $(window).on('scroll.ev_page_home_desktop',function() {
              update_entity_position();
              toogle_videos_play_class();
              toogle_showreel_play('desktop');
            });
          
          }
          // Init ou passage au Mobile
          else if ( mqs_data.group_range == 'mobile' && mqs_data.base_event == 'ready'
                 || mqs_data.group_range == 'mobile' && mqs_data.group_type == 'newrange' )
          {

            // Nettoyage
            if ( mqs_data.group_range_previous == 'desktop' )
            {          
              // unbind desktop events
              $( "body, body *" ).off('.ev_page_home_desktop');
              $( window ).off('.ev_page_home_desktop');
              
              // stop entities video
              $('div.field-name-field-entities video').each(function() {
                $(this)[0].pause();  
              });
              
              // stop showreel
              clearInterval(sr_timer); 
              $('#showreel video.sr_video_desk').each(function() {
                $(this)[0].pause();  
              });  
              txt1 = '';
              txt2 = '';
              $('#showreel div.txt1').html('');
              $('#showreel div.txt2').html('');             
              
              // cleaning scroll stuff
              $('#entities_ghost').css('height','');
              $('#entities div.node-entity').css('top','');
              $('#entities div.node-entity').css('width','');
            }
            
            // mobile scroll
            var last_scroll=0;
            $(window).on('scroll.ev_page_home_mobile',function() {
              var st = $(window).scrollTop();
              //console.log(st);
              if (st>150 && st>last_scroll) {
                $('#header_mob').addClass('canhide');
              } else {
                $('#header_mob').removeClass('canhide');
              }
              last_scroll = st;
            });
            
            // mobile menu
            $('#header_mob div.burger').on('click.ev_page_home_mobile', function() {
              $('#header_mob, #menu_mob').addClass('menu_show');
            });
            $('#header_mob div.close').on('click.ev_page_home_mobile', function() {
              $('#header_mob, #menu_mob').removeClass('menu_show');
              $('#header_mob').removeClass('canhide'); // pour masquage uniquement après le prochain scroll
            });
            $('#menu_mob a').on('click.ev_page_home_mobile', function() {
              // click sur lien ancre, on ferme le menu et le header
              $('#header_mob, #menu_mob').removeClass('menu_show');
              setTimeout(function() {
                $('#header_mob').addClass('canhide');
              },300);
            });
            
            // showreel mobile
            var video = $('#showreel video.sr_video_mob').get(0);
            makeVideoPlayableInline(video, false);    
            
            $('#showreel div.mobile_play_button').on('click.ev_page_home_mobile', function() {
              var $video = $('#showreel video.sr_video_mob');
              if ($video.length == 1) {
                console.log('play mob sr');
                $video.addClass('canplay');
                $(this).hide();
                toogle_showreel_play('mobile');
                //$video[0].currentTime = 0;
                //$video[0].play();
              };
            });
            
            // mobile scroll
            $(window).on('scroll.ev_page_home_mobile',function() {
              toogle_showreel_play('mobile');
            });            
            
          } 
          // resize desktop
          else if ( mqs_data.group_range == 'desktop' && mqs_data.base_event == 'resize') {
            update_entity_width();
            update_entity_position();
            toogle_videos_play_class();
            update_menu_desk_size();
          }
          
         
       
        }); // end mqsync event
    
      });
    }
  
  }
})(jQuery);
;
