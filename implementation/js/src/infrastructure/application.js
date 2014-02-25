/**
 * Main application definition.
 *
 * Usage
 * ----------------------------
 * ###How to start my app?
 * 1. Application.setup({config});
 * 2. [add your custom code in between for additional app initializers and events and route config];
 * 3. Application.run();
 *
 * ###How to create app elements?
 * 4. Application.create(type, config);
 * 		1. Model/Collection: {
 * 			entity: ...,
 * 			[rest of normal Backbone.Model/Collection options]
 * 		};
 * 		2. Context: {
 * 			[name]: if you don't name the context, we will use Default,
 * 			template: '#id' or '<...>' or ['<...>', '<...>'],(auto functional attribute: region, view)
 * 			[requireLogin]: 'true' / 'false'(default)
 * 			[onNavigateTo]: function(module path string)
			[rest of normal Marionette.Layout options] - if you override initialize + onShow, the default region detect and view showing behavior will be removed.
 * 		};
 * 		3. Regional: { -- for automatically loading through layout template. 
 * 			name:, (id in Marionette.Layout.Views -- see lib+-/marionette/view.js)
 * 			template: '#id' or '<...>' or ['<...>', '<...>'], (possible functional attribute: region, ui)
 * 			[type]: 'ItemView'(default)/ Layout/ CollectionView/ CompositeView (Marionette Views)
 * 			[rest of normal Marionette.(View type of your choice) options] 
 * 		};
 * 		4. Parts: (shared widgets and editors)
 * 		...TBI
 *
 * Optional
 * --------
 * You can also config NProgress.
 *
 * @author Tim.Liu
 * @create 2014.02.17
 */

/**
 * Setup Global vars and Config Libs
 * ---------------------------------
 */
_.each(['document', 'window'], function(coreDomObj){
	window['$' + coreDomObj] = $(window[coreDomObj]);
});

Swag.registerHelpers();
NProgress.configure({
  //minimum: 0.1
  //template: "<div class='....'>...</div>"
  //ease: 'ease', speed: 500
  //trickle: false
  //trickleRate: 0.02, trickleSpeed: 800
  //showSpinner: false
});

/**
 * Define Application & Core Modules
 * ---------------------------------
 * Modules: API, Context(regional-views as sub-modules), Widget, Editor, Util
 * Methods:
 * 	setup();
 * 	run();
 * 	create(); - universal object (model/collection/views[context/regional-view/widget/editor]) creation point [hierarchy flattened to enhance transparency]. 
 */
Application = new Backbone.Marionette.Application();
_.each(['Core', 'Util', 'Views'], function(coreModule){
	Application.module(coreModule);
});

;(function(){
	/**
	 * 
	 * Application.setup(config) method
	 * ---------------------------------
	 * config:
	 * theme,
	 * template,
	 * contextRegion,
	 * defaultContext,
	 * fullScreen,
	 * rapidEventDebounce,
	 * baseAjaxURI,
	 * api: {
	 * 	'entity': {
	 * 		'type of ops': {
	 * 			op1: {
	 * 				type: , url: , parse: , fn: see - core/api.js
	 * 			}
	 * 		}
	 * 	}
	 * }
	 * 
	 */
	Application.setup = function(config){
		//1. Configure.
		Application.config = _.extend({

			//Defaults:
			theme: '_dev',
			template: '',
			//e.g:: have a unified layout template.
			/**
			 * ------------------------
			 * |		top 	      |
			 * ------------------------
			 * | left | center | right|
			 * |	  |        |      |
			 * |	  |        |      |
			 * |	  |        |      |
			 * |	  |        |      |
			 * ------------------------
			 * |		bottom 	      |
			 * ------------------------		 
			 * 
			 * @type {String}
			 */		
			contextRegion: 'app',
			defaultContext: 'Default', //This is the context (name) the application will sit on upon loading.
			loginContext: 'Login', //This is the fallback context (name) when the user needs to authenticate with server.
			fullScreen: false, //This will put <body> to be full screen sized (window.innerHeight).
	        rapidEventDebounce: 200, //in ms this is the rapid event debounce value shared within the application (e.g window resize).
	        //Pre-set RESTful API configs (see Application.Core.API core module) - Modify this to fit your own backend apis.
	        baseAjaxURI: null,
	        api: {
	            //_Default_ entity is your fallback entity, only register common api method config to it would be wise, put specific ones into your context.module.
	            _Default_: {
	                data: {
	                    read: {
	                        type: 'GET',
	                        url: function(entity, category, method, options){
	                            if(options.model && options.model.id){
	                                return '/' + category + '/' + entity + '/' + options.model.id;
	                            }else {
	                                return '/' + category + '/' + entity;
	                            }
	                        },
	                        parse: 'payload',
	                    },
	                    create: {
	                        type: 'POST',
	                        url: function(entity, category, method, options){
	                            return '/' + category + '/' + entity;
	                        },
	                        parse: 'payload',
	                    },
	                    update: {
	                        type: 'PUT',
	                        parse: 'payload',
	                        url: function(entity, category, method, options){
	                            return '/' + category + '/' + entity + '/' + options.model.id;
	                        }

	                    },
	                    'delete': {
	                        type: 'DELETE',
	                        url: function(entity, category, method, options){
	                            return '/' + category + '/' + entity + '/' + options.model.id;
	                        }
	                    }
	                }
	            }
	        }
		}, config);

		//2 Detect Theme
		var theme = URI(window.location.toString()).search(true).theme || Application.config.theme;
		Application.Util.rollTheme(theme);			

		//3. Setup Application
		//3.1 Ajax Global
		/**
		 * Notifications
		 * -------------
		 * Default SUCCESS/ERROR reporting on ajax op globally.
		 * Success Notify will only appear if ajax options.notify = true
		 */
		$document.ajaxSuccess(function(event, jqxhr, settings){
			if(settings.notify)
				Application.Util.Notify.success('Operation Successful', '|', settings.type, settings.url.split('?')[0]);
		});

		$document.ajaxError(function(event, jqxhr, settings, exception){
			if(settings.notify === false) return;
			try{
				var errorStr = $.parseJSON(jqxhr.responseText).error;
			}catch(e){
				var errorStr = errorStr || exception;
			}
			Application.Util.Notify.error(errorStr, '|', settings.type, settings.url.split('?')[0]);
		});

		/**
		 * Progress
		 * --------
		 * Configure NProgress as global progress indicator.
		 */
		$document.ajaxStart(function() {
			NProgress.start();
		});
		$document.ajaxStop(function() {
			NProgress.done();
		});

		/**
		 *
		 * Base URI & Crossdomain
		 * ----------------------
		 * Preferred lvl of interference:
		 * $.ajaxPrefilter()
		 * [$.ajaxSetup()]
		 * [$.ajaxTransport()]
		 *
		 * For instrumenting a global behavior on the ajax calls according to app.config
		 * e.g:
		 * 1. base uri is ?q=/.../... instead of /.../... directly
		 * 2. crossdomain ajax support
		 */
			$.ajaxPrefilter('json', function(options){

				//base uri:
				if(Application.config.baseAjaxURI)
					options.url = Application.config.baseAjaxURI + options.url;

				//crossdomain:
				var crossdomain = Application.config.crossdomain;
				if(crossdomain.enabled){
					options.url = (crossdomain.protocol || 'http') + '://' + (crossdomain.host || 'localhost') + ((crossdomain.port && (':'+crossdomain.port)) || '') + (/^\//.test(options.url)?options.url:('/'+options.url));
					options.crossDomain = true;
					options.xhrFields = _.extend(options.xhrFields || {}, {
						withCredentials: true //persists session cookies.
					});
				}

				//cache:[for IE?]
				options.cache = false;

			});		

		//3.2 Initializers (Layout, Navigation)
		/**
		 * Setup the application with content routing (context + module navigation).
		 *
		 * Global Application Events:
		 * login context.form fires:
		 * 		app:user-changed - user will be stored at app.user (app.user === undefined means user has logged out see Context.Shared.User)
		 * app listens to >>>
		 *   	app:navigate (contextName, moduleName) this is used to invoke app.router.navigate method.
		 * app fires >>>
		 * 		(app:)view:resized - upon window resize event
		 *   	app:context-switched (contextName)
		 *   	context:navigate-to (moduleName)
		 * 
		 * 
		 * @author Tim.Liu
		 * @update 2013.09.11
		 * @update 2014.01.28 
		 * - refined/simplified the router handler and context-switch navigation support
		 * - use app:navigate (contextName, moduleName) at all times.
		 */

		//Application init: Hook-up Default RESTful Data APIs (from config.js)
		Application.addInitializer(function(options){
			Application.Core.API.registerAll(Application.config.api);
		});

		//Application init: Global listeners
		Application.addInitializer(function(options){
			//Context switching utility
			function navigate(context, module){
				var targetContext = Application.Core.Context[context];
				if(!targetContext) throw new Error('DEV::Application::You must have the requred context ' + context + ' defined...'); //see - special/registry/context.js			
				if(Application.currentContext !== targetContext) {
					Application.currentContext = targetContext;

					//if the context requires user to login but he/she didn't, we remember the navi hash path and switch to the 'Login' context.				
					if(Application.currentContext._config.requireLogin && !Application.Util.touch()){
						Application.currentContext = Application.Core.Context[Application.config.loginContext];
					}
					if(!Application[Application.config.contextRegion]) throw new Error('DEV::Application::You don\'t have region \'' + Application.config.contextRegion + '\' defined');		
					Application[Application.config.contextRegion].show(new Application.currentContext.Layout());
					//fire a notification round to the sky.
					Application.trigger('app:context-switched', Application.currentContext.name);
				}			
				Application.currentContext.trigger('context:navigate-to', module);
			};		
			
			Application._navigate = navigate; //this is in turn hooked with the app router, see below Application init: Routes
			Application.listenTo(Application, 'app:navigate', function(context, module){
				Application.router.navigate(_.string.rtrim(['#navigate', context, module].join('/'), '/'), true);
			});
		});	

		//Application init: Hookup window resize and app.config fullScreen, navigate to default context.
		Application.addInitializer(function(options){

			var $body = $('body');

			function trackAppSize(){
				Application.trigger('view:resized', {h: window.innerHeight, w: window.innerWidth});
				if(Application.config.fullScreen){
					$body.height(window.innerHeight);
				}
			};
			trackAppSize();
			$window.on('resize', _.debounce(trackAppSize, Application.config.rapidEventDebounce));
			
			if(Application.config.fullScreen){
				$body.css({
					overflow: 'hidden',
					margin: 0,
					padding: 0					
				});
			}

			//2.Auto-detect and init context (view that replaces the body region). see the Context.Login
			if(!window.location.hash){
				window.location.hash = ['#navigate', Application.config.defaultContext].join('/');
			}
		});

		//Application init: Context Switching by Routes (can use href = #navigate/... to trigger them)
		Application.on("initialize:after", function(options){
			//init client page router and history:
			var Router = Backbone.Marionette.AppRouter.extend({
				appRoutes: {
					'(navigate)(/:context)(/:module)' : 'navigateTo', //navigate to a context and signal it about :module (can be a path for further navigation within)
				},
				controller: {
					navigateTo: function(context, module){
						Application._navigate(context, module);
					},
				}
			});

			Application.router = new Router();
			if(Backbone.history)
				Backbone.history.start();

		});

		return Application;
	};

	/**
	 * Define app starting point function
	 * ----------------------------------
	 * 
	 */
	Application.run = function(){

		$document.ready(function(){
			//1. Put main template into position and scan for regions.
			var regions = {};
			var tpl = Application.Util.Tpl.build(Application.config.template);
			$('#main').html(tpl.string).find('[region]').each(function(index, el){
				var name = $(el).attr('region');
				regions[name] = '#main div[region="' + name + '"]';
			});
			Application.addRegions(_.extend(regions, {
				app: 'div[region="app"]'
			}));

			//2. Show Regional Views defined by region.$el.attr('view');
			_.each(regions, function(selector, r){
				Application[r].ensureEl();
				var RegionalView = Marionette.Layout.Views[Application[r].$el.addClass('app-region region region-' + _.string.slugify(r)).attr('view')];
				if(RegionalView) Application[r].show(new RegionalView());
			});		

			//3. Start the app
			Application.start();

		});

		return Application;

	};

	/**
	 * Define app universal object creation api entry point
	 * ----------------------------------------------------
	 */
	Application.create = function(type, config){
		switch(type){
			
			case 'Model': case 'Collection':
				var obj = new Backbone[type](config);
				return obj.bindToEntity(config.entity);
			break;


			case 'Context':
				return Application.Core[type].create(config);
			break;
			case 'Regional':
				return Marionette.Layout.regional(config);
			break;


			//need to define/register View definition before create...
			case 'Widget': case 'Editor':
				return Application.Core[type].create(config.name, config);
			break;


			default:
				throw new Error('DEV::APP::create() - You can not create an object of type ' + type);
			break;
		}
	}

})();


