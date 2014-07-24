;(function(app){

	app.regional('RemoteTpl', {
		template: '@test-ct.html',
		navRegion: 'bottom',
		onShow: function(){
			this.getRegion('left').show(app.view({
				template: '@test/test2.html' //nested template path, != @test2.html
			}, true));

			this.getRegion('right').show(app.view({
				template: '@test.html' //same template will be cached and will not trigger a re-fetch.
			}, true));
		},
		onNavigationEnd: function(){
			this.getRegion('bottom').show(app.view({
				template: '@test2.html' //cached template in all.json will not trigger a re-fetch either.
			}, true));
		}
	});

})(Application);