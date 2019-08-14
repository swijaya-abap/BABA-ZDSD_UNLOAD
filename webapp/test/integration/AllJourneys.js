/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"com/baba/ZDSD_UNLOAD_V3/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"com/baba/ZDSD_UNLOAD_V3/test/integration/pages/Worklist",
	"com/baba/ZDSD_UNLOAD_V3/test/integration/pages/Object",
	"com/baba/ZDSD_UNLOAD_V3/test/integration/pages/NotFound",
	"com/baba/ZDSD_UNLOAD_V3/test/integration/pages/Browser",
	"com/baba/ZDSD_UNLOAD_V3/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "com.baba.ZDSD_UNLOAD_V3.view."
	});

	sap.ui.require([
		"com/baba/ZDSD_UNLOAD_V3/test/integration/WorklistJourney",
		"com/baba/ZDSD_UNLOAD_V3/test/integration/ObjectJourney",
		"com/baba/ZDSD_UNLOAD_V3/test/integration/NavigationJourney",
		"com/baba/ZDSD_UNLOAD_V3/test/integration/NotFoundJourney"
	], function () {
		QUnit.start();
	});
});