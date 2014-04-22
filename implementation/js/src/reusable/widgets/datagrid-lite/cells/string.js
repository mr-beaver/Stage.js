/**
 * The Default String Column Cell Definition.
 *
 * @author Tim.Liu
 * @created 2013.11.25
 * @updated 2014.04.22
 */


;(function(app){

	app.widget('StringCell', function(){

		var View = app.view({
			template: '<span>{{{value}}}</span>',
		});

		return View;
	});

})(Application);