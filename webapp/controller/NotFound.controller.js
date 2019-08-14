sap.ui.define([
		"com/baba/ZDSD_UNLOAD_V3/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("com.baba.ZDSD_UNLOAD_V3.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);