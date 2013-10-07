/**
 * ==========================
 * Base Libs Warmup & Hacks
 * ==========================
 * 1. +Swag (Handlebars Helpers)
 * 2. +Handlebars to Backbone.Marionette
 * 3. +UI Locking support to view regions (without Application scope total lockdown atm...)
 * 4. +Pagination ability to Backbone.Collection
 *
 * @author Tim.Liu
 * @create 2013.09.11
 */
;(function(window, Swag, Backbone, Handlebars){

	//1 Hook up additional Handlebars helpers.
	Swag.registerHelpers();

	//2 Override to use Handlebars templating engine with Backbone.Marionette
	Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(rawTemplate) {
	  return Handlebars.compile(rawTemplate);
	};

	//3 UI Locks support
	//Add a _uilocks map for each of the UI view on screen, for managing UI action locks for its regions
	//Also it will add in a _all region for locking the whole UI
	//Usage: 
	//		1. lockUI/unlockUI([region], [caller])
	//		2. isUILocked([region])
	_.extend(Backbone.Marionette.View.prototype, {
		//only for layouts
		initUILocks: function(){
			if(this.regions){
				this._uilocks = _.reduce(this.regions, function(memo, val, key, list){
					memo[key] = false;
					return memo;
				}, {_all: false});
			}
		},

		//region, caller are optional
		lockUI: function(region, caller){
			region = this._checkRegion(region);

			caller = caller || '_default_';
			if(!this._uilocks[region]){ //not locked, lock it with caller signature!
				this._uilocks[region] = caller;
				return true;
			}
			if(this._uilocks[region] === caller) //locked by caller already, bypass.
				return true;
			//else throw error...since it is already locked, by something else tho...
			throw new Error('DEV::View UI Locks::This region ' + region + ' is already locked by ' + this._uilocks[region]);
		},

		//region, caller are optional
		unlockUI: function(region, caller){
			region = this._checkRegion(region);

			caller = caller || '_default_';
			if(!this._uilocks[region]) return true; //not locked, bypass.
			if(this._uilocks[region] === caller){ //locked by caller, release it.
				this._uilocks[region] = false;
				return true;
			}
			//else throw error...
			throw new Error('DEV::View UI Locks::This region ' + region + ' is locked by ' + this._uilocks[region] + ', you can NOT unlock it with ' + caller);
		},

		isUILocked: function(region){
			region = this._checkRegion(region);

			return this._uilocks[region];
		},

		//=====Internal Workers=====
		_checkRegion: function(region){
			if(!region)
				region = '_all';
			else
				if(!this.regions[region])
					throw new Error('DEV::View UI Locks::This region does NOT exist - ' + region);
			return region;
		}
		//=====Internal Workers=====				

	});

	//4 Pagination - extend the Backbone.Collection to let it have this ability
	//(Warning: To make the code simpler, we put a special parse() in data-units.js for collections to save
	//			the fetched result without feeding all of them to the model factory. (only in mode:client)
	//			This way, we don't have to make another 'window' collection for updating the UI.
	//)
	//+Config: {
	//	mode: client/server - non 'server' value means 'client' mode.
	//	cache: false(default)/true (completely swap the content of this collection or incrementally feed it)
	//	pageSize: (default: 25) - 0 means showing all
	//	params: { optionally control the server params used. //Hard coded atm...
	//		offset: 'page', 
	//		size: 'per_page'
	//	}
	//}
	//+Properties: { should be Read-Only, can only be changed from calling the functions below.
	//	currentPage:
	//	totalRecords: in cached server mode, this can be null
	//}
	//+Func: { 
	//	load: instead of calling fetch directly, we use load(options) to do some preprocess.
	//		+options: apart from the normal options to be passed to fetch() we add
	//				page: number or nothing -> load specific page or page 1
	//			
	//	nextPage: load currentPage + 1;
	//	prevPage: only works if 'cache' is set to false;
	//}
	//+Events 
	//	1. pagination:updatePageNumbers - fired upon 'sync' after 'reset';
	//	2. pagination:updatePageNumbers:clientMode - fired upon 'sync' after 'add' and 'destroy' after 'remove', only in non-cached client mode.
	//Note that: at any given time, you can still use fetch(), using load() will always enforce a paginated fetch()
	_.extend(Backbone.Collection.prototype, {

		//To opt-in the pagination with any Backbone.Collection
		//Invoke this function in your collection definition's initialize()
		//Warning:: your parse() method must be overridden to provide support to the load() method below, see collection's parse() method override in - special/registry/data-units.js
		//You don't have to do anything if your collection is created by the DataUnits special registry module.
		enablePagination: function(config){
			this.pagination = _.extend({
				mode: 'client',
				cache: false, //this means the collection is not used to cache previously loaded records. However, we do save the fetched result in client mode. see - data-units.js
				pageSize: 10,
			}, this.pagination, config);

			//we need to +/- related records from _cachedResponse array as well.
			function signalClientModePageNumberUpdate(collection){
				collection.totalRecords = collection._cachedResponse.length;
				collection.trigger('pagination:updatePageNumbers:clientMode');
			}
			var eWhiteList = {
				'sync': true,
				'destroy': true
			};
			this.on('all', function(event, target){
				if(!eWhiteList[event]) return;
				if(this.pagination.cache) return;
				if(this === target){
					//Note that this === target means the 'sync' detected is after 'reset'. This is true for both client and server mode.
					this.trigger('pagination:updatePageNumbers');
					//1. we are only interested in sync after add and destroy after remove.
					return;
				}
				if(this.pagination.mode !== 'client') return;
				//2. we only need to do this for non-cached client mode, since in other modes, the page numbers are either not needed or updated by server's replay about total records.
				switch(event){
					case 'sync':
						this._cachedResponse.push(target.attributes);
						signalClientModePageNumberUpdate(this);
						break;
					case 'destroy':
						console.log('-', target.id);
						for (var i = this._cachedResponse.length - 1; i >= 0; i--) {
							if(this._cachedResponse[i][target.idAttribute] === target.id){
								this._cachedResponse.splice(i, 1);
								break;
							}
						};
						signalClientModePageNumberUpdate(this);
						break;
					default:
						break;
				}

			});
		},

		//A version of fetch() with pagination config applied. Always use load if possible.
		load: function(page, options){
			if(_.isObject(page)){
				options = page || {};
			}
			options = options || {};

			if(this.pagination){
				page = (_.isNumber(page) && page) || 1;
				//Note that we don't skip fetch when (this.currentPage === page), coz the page would be the same during a 'UI module' swap/navigate, like in the Admin context.

				this.currentPage = page;
				if(this.pagination.mode === 'client'){
					if(!this._cachedResponse || options.reset){
						//go fetch the records again.
						this.fetch(options);
					}else {
						//go to page
						this.set(this._cachedResponse.slice((this.currentPage-1) * this.pagination.pageSize, this.currentPage * this.pagination.pageSize), {remove: !this.pagination.cache});
					}
				}else {
					//server mode
					options.data = _.extend(options.data || {}, {
						page: this.currentPage,
						per_page: this.pagination.pageSize
					});
					_.extend(options, {
						remove: !this.pagination.cache
					});
					this.fetch(options);
				}
			}else {
				this.fetch(options); //ignore pagination. normal fetch();
			}
		}
	});

})(window, Swag, Backbone, Handlebars);