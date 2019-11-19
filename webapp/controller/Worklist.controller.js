/*global location history */
sap.ui.define([
	"com/baba/ZDSD_UNLOAD_V3/controller/BaseController",
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel",
	"com/baba/ZDSD_UNLOAD_V3/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator", "sap/m/Dialog"
], function (BaseController, MessageBox, JSONModel, formatter, Filter, FilterOperator, Dialog) {
	"use strict";

	return BaseController.extend("com.baba.ZDSD_UNLOAD_V3.controller.Worklist", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			var oViewModel,
				iOriginalBusyDelay,
				oTable = this.byId("table");

			// Put down worklist table's original value for busy indicator delay,
			// so it can be restored later on. Busy handling on the table is
			// taken care of by the table itself.
			iOriginalBusyDelay = oTable.getBusyIndicatorDelay();
			// keeps the search state
			this._aTableSearchState = [];
			this.globalVar = {};
			this.globalVar.MDT_FLOSE = "";

			// Model used to manipulate control states
			oViewModel = new JSONModel({
				worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
				shareOnJamTitle: this.getResourceBundle().getText("worklistTitle"),
				shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
				shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
				tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
				tableBusyDelay: 0,
				// Begin of Version 3
				resetBtnVisibility: false,
				// End of Version 3
				CbVirtual: {
					enabled: false,
					selected: false,
					visible: false
				},
				CbFinal: {
					enabled: false,
					selected: false,
					visible: false
				}
			});
			this.setModel(oViewModel, "worklistView");

			this.oViewModel = oViewModel;

			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oTable.attachEventOnce("updateFinished", function () {
				// Restore original busy indicator delay for worklist's table
				oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
			});

			var yesterdayDate = new Date();

			yesterdayDate.setDate(yesterdayDate.getDate());

			this.byId("DATE").setDateValue(yesterdayDate);

			var oModelt = new JSONModel();
			this.getView().byId("table").setModel(oModelt);
			this.getView().byId("table").getModel().setSizeLimit('500');

			var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
			this.getView().byId("oSelect1").setModel(oModel1);
			this.getView().byId("oSelect1").getModel().setSizeLimit('500');

			var oModelt1 = new JSONModel();
			this.getView().byId("oSelect2").setModel(oModelt1);

			var myModel = this.getOwnerComponent().getModel();
			myModel.setSizeLimit(500);

			this.oSearchField = this.getView().byId("NMATNR");
		},

		onBusyS: function (oBusy) {
			oBusy.open();
			oBusy.setBusyIndicatorDelay(40000);
		},

		onBusyE: function (oBusy) {
			oBusy.close();
		},

		/* =========================================================== */
		/* Begin of MDT Feature										   */
		/* =========================================================== */
		onMDTOk: function () {
			if (this.byId("RbMDTVirtual").getSelected()) {
				this.globalVar.MDT_VCHECKIN = "X";
				this.byId("CbVirtual").setSelected(true);
			}
			if (this.byId("RbMDTFinal").getSelected()) {
				this.globalVar.MDT_FLOSE = "X";
				var kunnr = this.getView().byId("oSelect1").getSelectedKey();
				var date = this.getView().byId("DATE").getValue();
				var oModel = this.getView().byId("table").getModel();
				var val = "";
				var uncnf = "";
				this.onblank(this);
				this.byId("CbFinal").setSelected(true);
				this.onGetM(kunnr, date, uncnf, oModel, val);
			}
			this.byId("MDTDialog").destroy();
		},

		/* =========================================================== */
		/* Begin of Reset Unloading Feature							   */
		/* =========================================================== */
		onReset: function () {
			var that = this;
			if (this.byId("TOUR").getValue() === "") {
				sap.m.MessageToast.show("No tour data selected");
			} else {
				MessageBox.warning(
					"This will reset the unloading order and revert back all the changes done so far to the unloading order. Do you want to continue?", {
						actions: [MessageBox.Action.YES, MessageBox.Action.NO],
						onClose: function (sAction) {
							if (sAction === MessageBox.Action.YES) {
								that._showResetDialog();
							}
						}
					}
				);
			}
		},

		_showResetDialog: function () {
			this._openDialog("ResetDialog", "Reset Unloading");
		},

		onRdOk: function () {
			var message = this._validateReset();
			if (message !== "") {
				MessageBox.error(message);
			} else {
				this._resetUnloading();
				this.byId("ResetDialog").destroy();
			}
		},

		_validateReset: function () {
			var message = "";

			if (this.globalVar.captcha !== undefined && this.globalVar.captcha !== "") {
				var inCaptcha = this.byId("RdInCaptcha").getValue();
				var captcha = this.globalVar.captcha;
				this.globalVar.captcha = this._generateCaptcha();
				this.byId("RdGenCaptcha").setValue(this.globalVar.captcha);
				if (inCaptcha !== captcha) {
					message = "Wrong captcha.";
					return message;
				}
			}

			if (this.globalVar.adminPass === "") {
				message = "Loader password is not maintained in the system. Reset unsuccessful. Contact System Admin";
			} else if (this.globalVar.adminPass !== this.byId("RdPassword").getValue()) {
				message = "Wrong secure code.";
			}

			if (message !== "") {
				if (this.globalVar.wrongPass === undefined) this.globalVar.wrongPass = 0;

				if (this.globalVar.wrongPass < 5) {
					this.globalVar.wrongPass += 1;

					if (this.globalVar.wrongPass === 5) {
						this.byId("RdGenCaptcha").setVisible(true);
						this.byId("RdInCaptcha").setVisible(true);
						this.byId("RdCaptchaLabel").setVisible(true);
						this.globalVar.captcha = this._generateCaptcha();
						this.byId("RdGenCaptcha").setValue(this.globalVar.captcha);
					}
				}
				this.byId("RdInCaptcha").setValue("");
				this.byId("RdPassword").setValue("");
			}

			return message;
		},

		_resetUnloading: function () {
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
			var oEntry1 = {};
			var that = this;
			var oBusy = new sap.m.BusyDialog();

			this.onBusyS(oBusy);

			oEntry1.TOUR_ID = that.getView().byId("TOUR").getValue();
			oModel.create("/RESETSet", oEntry1, {
				success: function (oData, oResponse) {
					MessageBox.information("The unloading order has been reset successfully");
					that.onFet();
					that.onBusyE(oBusy);
				},
				error: function (oResponse) {
					that.onBusyE(oBusy);
					var oMsg = JSON.parse(oResponse.responseText);
					jQuery.sap.require("sap.m.MessageBox");
					sap.m.MessageToast.show(oMsg.error.message.value);
				}
			});
		},

		onRdCancel: function () {
			this.byId("ResetDialog").destroy();
		},
		/* =========================================================== */
		/* End of Reset Unloading Feature							   */
		/* =========================================================== */

		/* =========================================================== */
		/* Begin of Show Related Feature							   */
		/* =========================================================== */
		onShowRelated: function () {
			var message = this._validateShowRelated();
			if (message !== "") {
				sap.m.MessageToast.show(message);
			} else {
				this._openDialog("ShowRelatedDialog", "Choose Option");
			}
		},

		_validateShowRelated: function () {
			var message;
			var selectedItem = this.byId("table").getSelectedContexts();
			if (selectedItem.length === 0) {
				message = "To use this function, please select single line";
			} else if (selectedItem.length > 1) {
				message = "To use this function, only select single line at a time";
			} else {
				this.srdSelectedObject = selectedItem[0].getObject();
				message = "";
			}
			return message;
		},

		onSrdOk: function () {
			this._filterRelated();
			this.byId("ShowRelatedDialog").destroy();
		},

		_filterRelated: function () {
			var kunnr = this.getView().byId("oSelect1").getSelectedKey();
			var date = this.getView().byId("DATE").getValue();
			var oModel = this.getView().byId("table").getModel();
			var val = "";
			var uncnf = "";
			this.onRef();
			this.onblank(this);
			this.onGetM(kunnr, date, uncnf, oModel, val);

			if (this.byId("Sku").getSelected()) {
				var sQuery = this.srdSelectedObject.MATNR;
			} else {
				var sPos = this.srdSelectedObject.MAKTX.indexOf(" ");
				if (sPos === -1) {
					sQuery = this.srdSelectedObject.MAKTX;
				} else {
					sQuery = this.srdSelectedObject.MAKTX.substring(0, sPos);
				}
			}
			var aTableSearchState = [new Filter([
				new Filter("MATNR", FilterOperator.Contains, sQuery),
				new Filter("MAKTX", FilterOperator.Contains, sQuery)
			], false)];
			this._applySearch(aTableSearchState);
			// this._oGlobalFilter = null;

			// if (sQuery) {
			// 	this._oGlobalFilter = new Filter([
			// 		new Filter("MATNR", FilterOperator.Contains, sQuery),
			// 		new Filter("MAKTX", FilterOperator.Contains, sQuery)
			// 	], false);
			// }
		},

		onSrdClose: function () {
			this.byId("ShowRelatedDialog").destroy();
		},
		/* =========================================================== */
		/* Begin of Show Related Feature							   */
		/* =========================================================== */

		/* =========================================================== */
		/* Begin of Damage in Transit								   */
		/* =========================================================== */
		onDamage: function () {
			var message = this._validateGetDamage();
			if (message !== "") {
				sap.m.MessageToast.show(message);
			} else {
				var oBusy = new sap.m.BusyDialog();
				var that = this;
				this.onBusyS(oBusy);
				var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
				oModel1.read("/GETDAMAGESet", {
					success: function (oData, oResponse) {
						var res = oData.results;
						that.damageSelectedObject.COCI_REASON_FROM = that.damageSelectedObject.VAL.substring(4, 6);
						if (that.damageSelectedObject.COCI_REASON_FROM === "") {
							that.damageSelectedObject.COCI_REASON_FROM = that.damageSelectedObject.VAL.substring(0, 3);
						}
						if (res.length > 0) {
							var itemData = [];
							for (var i = 0; i < res.length; i++) {
								var itemRow = {
									COCI_REASON: res[i].COCI_REASON,
									COCI_RSN_TXT: res[i].COCI_RSN_TXT
								};
								if (that.damageSelectedObject.COCI_REASON_FROM !== itemRow.COCI_REASON &&
									!(that.damageSelectedObject.COCI_REASON_FROM === "PC" && itemRow.COCI_REASON === "GS")) {
									itemData.push(itemRow);
								}
							}
							var oModel = new JSONModel();
							oModel.setData({
								matnr: that.damageSelectedObject.MATNR,
								maktx: that.damageSelectedObject.MAKTX,
								qty: "",
								damageReason: itemData
							});
							that.getView().setModel(oModel, "Damage");
							that._openDialog("DamageDialog", "Damage in Transit");
						}
						that.onBusyE(oBusy);
					},
					error: function (oResponse) {
						that.onBusyE(oBusy);
						var oMsg = JSON.parse(oResponse.responseText);
						message = oMsg.error.message.value;
					}
				});
			}
		},

		_validateGetDamage: function () {
			var message;
			if (this.byId("TOUR").getValue() === "") {
				message = "No tour data selected";
			} else {
				var selectedItem = this.byId("table").getSelectedContexts();
				if (selectedItem.length === 0) {
					message = "To use this function, please select single TRA/PC line";
				} else if (selectedItem.length > 1) {
					message = "To use this function, only select single TRA/PC line at a time";
				} else {
					var itemObj = selectedItem[0].getObject();
					this.damageSelectedObject = itemObj;
					if (itemObj.VAL !== null && itemObj.VAL !== "") {
						var l_valret = itemObj.VAL.substring(0, 3);
						if (l_valret !== "TRA" && l_valret !== "PC") {
							message = "This feature is only applicable for TRA & PC";
						} else if (itemObj.ITEMNR === "000000") {
							message = "Please save this line to the unloading order before using Damage in Transit feature";
						} else {
							message = "";
						}
					}
				}
			}
			return message;
		},

		onDamageQtyLiveChange: function (oEvent) {
			this._checkInputQty(oEvent, "DamageQty");
		},

		onDamageOk: function () {
			var qty = this.byId("DamageQty").getValue();
			this.damageSelectedObject.COCI_REASON_TO = this.byId("DamageChgReas").getSelectedKey();
			if (qty === "" || qty === "0") {
				sap.m.MessageToast.show("Please provide quantity");
			} else if (Number(this.damageSelectedObject.QTYV) === 0 && Number(qty) > Number(this.damageSelectedObject.QTYC)) {
				sap.m.MessageToast.show("Transferring more than Actual Qty is not allowed");
			} else if (Number(this.damageSelectedObject.QTYV) < 0 && Number(qty) > Number(this.damageSelectedObject.QTYC)) {
				sap.m.MessageToast.show("In case of Goods Less, Transferring more than Actual Qty is not allowed");
			} else if (Number(this.damageSelectedObject.QTYV) > 0 && Number(qty) > Number(this.damageSelectedObject.QTYC)) {
				sap.m.MessageToast.show("In case of Goods More, Transferring more than Actual Qty is not allowed");
			} else if (this.damageSelectedObject.COCI_REASON_TO === "") {
				sap.m.MessageToast.show("Please provide change reason");
			} else if (this.damageSelectedObject.COCI_REASON_FROM === "PC" && this.damageSelectedObject.COCI_REASON_TO === "GS") {
				sap.m.MessageToast.show("Transferring from Good Stock to Good Stock is not allowed");
			} else {
				this._convertDamage(qty);
				this.byId("DamageDialog").destroy();
			}
		},

		_convertDamage: function (iQty) {
			var that = this;
			var qty = iQty;

			var oBusy = new sap.m.BusyDialog();
			this.onBusyS(oBusy);

			var oTable = this.getView().byId("table");
			var oModel2 = oTable.getModel();
			var aTableSearchState = [];
			this._applySearch(aTableSearchState);
			var aContexts = oTable.getItems();
			var itemData = [];

			var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
			oModel1.read("/TRFDAMAGESet(TOUR_ID='" + this.damageSelectedObject.TOUR_ID +
				"',MATNR='" + this.damageSelectedObject.MATNR +
				"',COCI_REASON_FROM='" + this.damageSelectedObject.COCI_REASON_FROM +
				"',COCI_REASON_TO='" + this.damageSelectedObject.COCI_REASON_TO +
				"',QTYC=" + qty + ")", {
					success: function (oData, oResponse) {
						var res = {};
						res = oData;

						if (res !== "") {
							for (var i = 0; i < aContexts.length; i++) {
								if (aContexts[i]._bGroupHeader === false) {
									var l_matnr = oModel2.getProperty("MATNR", aContexts[i].getBindingContext());
									var l_val = oModel2.getProperty("VAL", aContexts[i].getBindingContext()).substring(0, 3);
									var l_val_2 = oModel2.getProperty("VAL", aContexts[i].getBindingContext()).substring(4, 6);
									var l_ret = oModel2.getProperty("RET", aContexts[i].getBindingContext());

									var itemRow = {
										COMP: oModel2.getProperty("COMP", aContexts[i].getBindingContext()),
										RET: oModel2.getProperty("RET", aContexts[i].getBindingContext()),
										MATNR: oModel2.getProperty("MATNR", aContexts[i].getBindingContext()),
										MAKTX: oModel2.getProperty("MAKTX", aContexts[i].getBindingContext()),
										UOM: oModel2.getProperty("UOM", aContexts[i].getBindingContext()),
										QTYD: oModel2.getProperty("QTYD", aContexts[i].getBindingContext()),
										QTYC: oModel2.getProperty("QTYC", aContexts[i].getBindingContext()),
										TOUR_ID: oModel2.getProperty("TOUR_ID", aContexts[i].getBindingContext()),
										ITEMNR: oModel2.getProperty("ITEMNR", aContexts[i].getBindingContext()),
										EAN11: oModel2.getProperty("EAN11", aContexts[i].getBindingContext()),
										VAL: oModel2.getProperty("VAL", aContexts[i].getBindingContext()),
										QTYV: oModel2.getProperty("QTYV", aContexts[i].getBindingContext())
									};
									// Source from
									if ((l_ret === "2" && l_matnr === that.damageSelectedObject.MATNR && l_val_2 === that.damageSelectedObject.COCI_REASON_FROM) ||
										(l_ret === "" && l_matnr === that.damageSelectedObject.MATNR && l_val === that.damageSelectedObject.COCI_REASON_FROM)) {
										var l_planQty = Number(that.damageSelectedObject.QTYD) - Number(qty);
										itemRow.QTYD = String(l_planQty);
										itemRow.QTYC = String(Number(that.damageSelectedObject.QTYC) - Number(qty));
										itemRow.QTYV = String(Number(itemRow.QTYC) - l_planQty);
									}
									// Target to
									else
									if ((l_ret === "2" && l_matnr === that.damageSelectedObject.MATNR && l_val_2 === that.damageSelectedObject.COCI_REASON_TO) ||
										(l_ret === "" && l_matnr === that.damageSelectedObject.MATNR && l_val === "PC" &&
											that.damageSelectedObject.COCI_REASON_TO === "GS")) {
										l_planQty = Number(itemRow.QTYD) + Number(qty);
										itemRow.QTYD = String(l_planQty);
										itemRow.QTYC = String(Number(itemRow.QTYC) + Number(qty));
										if (l_planQty < 0) {
											itemRow.QTYV = itemRow.QTYC;
										} else {
											itemRow.QTYV = String(Number(itemRow.QTYC) - l_planQty);
										}

										var l_existingFound = true;
									}
									itemData.push(itemRow);
								}
							}

							if (!l_existingFound) {
								itemRow = {
									COMP: res.COMP,
									RET: res.RET,
									MATNR: res.MATNR,
									MAKTX: res.MAKTX,
									UOM: res.UOM,
									QTYD: res.QTYD,
									QTYC: res.QTYC,
									TOUR_ID: res.TOUR_ID,
									ITEMNR: res.ITEMNR,
									EAN11: res.EAN11,
									VAL: res.VAL,
									QTYV: res.QTYV
								};
								itemData.push(itemRow);
							}

							oModel2.setData({
								data: itemData
							});
							oTable.removeSelections(true);
							oModel2.refresh(true);
						}
						sap.m.MessageToast.show(qty + " PC of " + that.damageSelectedObject.COCI_REASON_FROM +
							" have been successfully transferred to " +
							that.damageSelectedObject.COCI_REASON_TO);
						that.onBusyE(oBusy);
					},
					error: function (oResponse) {
						that.onBusyE(oBusy);
						var oMsg = JSON.parse(oResponse.responseText);
						sap.m.MessageToast.show(oMsg.error.message.value);
					}
				});
		},

		onDamageCancel: function () {
			this.byId("DamageDialog").destroy();
		},

		/* =========================================================== */
		/* End of Damage in Transit									   */
		/* =========================================================== */

		/* =========================================================== */
		/* Begin of Change Return Reason							   */
		/* =========================================================== */
		onChgRetReas: function () {
			var message = this._validateChgReas();
			if (message !== "") {
				sap.m.MessageToast.show(message);
			} else {
				var oBusy = new sap.m.BusyDialog();
				var that = this;
				this.onBusyS(oBusy);
				var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
				oModel1.read("/CHGREASSet", {
					success: function (oData, oResponse) {
						var res = oData.results;
						that.crdSelectedObject.CHG_REASON_FROM = that.crdSelectedObject.VAL.substring(4, 6);
						if (res.length > 0) {
							var itemData = [];
							for (var i = 0; i < res.length; i++) {
								var itemRow = {
									CHG_REASON: res[i].CHG_REASON,
									CHG_REASON_TXT: res[i].CHG_REASON_TXT
								};
								if (that.crdSelectedObject.CHG_REASON_FROM !== itemRow.CHG_REASON) {
									itemData.push(itemRow);
								}
							}
							var oModel = new JSONModel();
							oModel.setData({
								matnr: that.crdSelectedObject.MATNR,
								maktx: that.crdSelectedObject.MAKTX,
								qty: "",
								crdChgReas: itemData
							});
							that.getView().setModel(oModel, "Crd");
							that._openDialog("ChgReasDialog", "Change Return Reason");
						}
						that.onBusyE(oBusy);
					},
					error: function (oResponse) {
						that.onBusyE(oBusy);
						var oMsg = JSON.parse(oResponse.responseText);
						message = oMsg.error.message.value;
					}
				});
			}
		},

		_validateChgReas: function () {
			var message;
			if (this.byId("TOUR").getValue() === "") {
				message = "No tour data selected";
			} else {
				var selectedItem = this.byId("table").getSelectedContexts();
				if (selectedItem.length === 0) {
					message = "To use this function, please select single RET line";
				} else if (selectedItem.length > 1) {
					message = "To use this function, only select single RET line at a time";
				} else {
					var itemObj = selectedItem[0].getObject();
					this.crdSelectedObject = itemObj;
					if (itemObj.VAL !== null && itemObj.VAL !== "") {
						var l_valret = itemObj.VAL.substring(0, 3);
						if (l_valret !== "RET") {
							message = "This feature is only applicable for RET";
						} else if (itemObj.ITEMNR === "000000") {
							message = "Please save this line to the unloading order before using Change Return Reason feature";
						} else {
							message = "";
						}
					}
				}
			}
			return message;
		},

		onCrdQtyLiveChange: function (oEvent) {
			this._checkInputQty(oEvent, "CrdQty");
		},

		onCrdOk: function () {
			var qty = this.byId("CrdQty").getValue();
			this.crdSelectedObject.CHG_REASON_TO = this.byId("CrdChgReas").getSelectedKey();
			if (qty === "" || qty === "0") {
				sap.m.MessageToast.show("Please provide quantity");
			} else if (Number(this.crdSelectedObject.QTYV) === 0 && Number(qty) > Number(this.crdSelectedObject.QTYC)) {
				sap.m.MessageToast.show("Transferring more than Actual Qty is not allowed");
			} else if (Number(this.crdSelectedObject.QTYV) < 0 && Number(qty) > Number(this.crdSelectedObject.QTYC)) {
				sap.m.MessageToast.show("In case of Goods Less, Transferring more than Actual Qty is not allowed");
			} else if (this.crdSelectedObject.CHG_REASON_TO === "") {
				sap.m.MessageToast.show("Please provide change reason");
			} else {
				this._convertChgReas(qty);
				this.byId("ChgReasDialog").destroy();
			}
		},

		_convertChgReas: function (iQty) {
			var that = this;
			var qty = iQty;

			var oBusy = new sap.m.BusyDialog();
			this.onBusyS(oBusy);

			var oTable = this.getView().byId("table");
			var oModel2 = oTable.getModel();
			var aTableSearchState = [];
			this._applySearch(aTableSearchState);
			var aContexts = oTable.getItems();
			var itemData = [];

			var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
			oModel1.read("/TRFCHGREASSet(TOUR_ID='" + this.crdSelectedObject.TOUR_ID +
				"',MATNR='" + this.crdSelectedObject.MATNR +
				"',CHG_REASON_FROM='" + this.crdSelectedObject.CHG_REASON_FROM +
				"',CHG_REASON_TO='" + this.crdSelectedObject.CHG_REASON_TO +
				"',QTYC=" + qty + ")", {
					success: function (oData, oResponse) {
						var res = {};
						res = oData;

						if (res !== "") {
							for (var i = 0; i < aContexts.length; i++) {
								if (aContexts[i]._bGroupHeader === false) {
									var l_matnr = oModel2.getProperty("MATNR", aContexts[i].getBindingContext());
									var l_val = oModel2.getProperty("VAL", aContexts[i].getBindingContext()).substring(4, 6);
									var l_ret = oModel2.getProperty("RET", aContexts[i].getBindingContext());

									var itemRow = {
										COMP: oModel2.getProperty("COMP", aContexts[i].getBindingContext()),
										RET: oModel2.getProperty("RET", aContexts[i].getBindingContext()),
										MATNR: oModel2.getProperty("MATNR", aContexts[i].getBindingContext()),
										MAKTX: oModel2.getProperty("MAKTX", aContexts[i].getBindingContext()),
										UOM: oModel2.getProperty("UOM", aContexts[i].getBindingContext()),
										QTYD: oModel2.getProperty("QTYD", aContexts[i].getBindingContext()),
										QTYC: oModel2.getProperty("QTYC", aContexts[i].getBindingContext()),
										TOUR_ID: oModel2.getProperty("TOUR_ID", aContexts[i].getBindingContext()),
										ITEMNR: oModel2.getProperty("ITEMNR", aContexts[i].getBindingContext()),
										EAN11: oModel2.getProperty("EAN11", aContexts[i].getBindingContext()),
										VAL: oModel2.getProperty("VAL", aContexts[i].getBindingContext()),
										QTYV: oModel2.getProperty("QTYV", aContexts[i].getBindingContext())
									};
									// Source from return
									if (l_ret === "1" && l_matnr === that.crdSelectedObject.MATNR && l_val === that.crdSelectedObject.CHG_REASON_FROM) {
										itemRow.QTYD = String(Number(that.crdSelectedObject.QTYD) - Number(qty));
										itemRow.QTYC = String(Number(that.crdSelectedObject.QTYC) - Number(qty));
									}
									// Target to return
									else
									if ((l_ret === "1" && l_matnr === that.crdSelectedObject.MATNR && l_val === that.crdSelectedObject.CHG_REASON_TO) ||
										(l_ret === "" && l_matnr === that.crdSelectedObject.MATNR && l_val === "PC" &&
											that.crdSelectedObject.CHG_REASON_TO === "GS")) {
										itemRow.QTYD = String(Number(itemRow.QTYD) + Number(qty));
										itemRow.QTYC = String(Number(itemRow.QTYC) + Number(qty));

										var l_existingFound = true;
									}
									itemData.push(itemRow);
								}
							}

							if (!l_existingFound) {
								itemRow = {
									COMP: res.COMP,
									RET: res.RET,
									MATNR: res.MATNR,
									MAKTX: res.MAKTX,
									UOM: res.UOM,
									QTYD: res.QTYD,
									QTYC: res.QTYC,
									TOUR_ID: res.TOUR_ID,
									ITEMNR: res.ITEMNR,
									EAN11: res.EAN11,
									VAL: res.VAL,
									QTYV: res.QTYV
								};
								itemData.push(itemRow);
							}

							oModel2.setData({
								data: itemData
							});
							oTable.removeSelections(true);
							oModel2.refresh(true);
						}
						sap.m.MessageToast.show(qty + " PC of " + that.crdSelectedObject.CHG_REASON_FROM + " have been successfully transferred to " +
							that.crdSelectedObject.CHG_REASON_TO);
						that.onBusyE(oBusy);
					},
					error: function (oResponse) {
						that.onBusyE(oBusy);
						var oMsg = JSON.parse(oResponse.responseText);
						sap.m.MessageToast.show(oMsg.error.message.value);
					}
				});
		},

		onCrdCancel: function () {
			this.byId("ChgReasDialog").destroy();
		},
		/* =========================================================== */
		/* End of Change Return Reason 			    				   */
		/* =========================================================== */

		/* =========================================================== */
		/* Begin of Open Box Feature								   */
		/* =========================================================== */
		onOpenBox: function () {
			var message = this._validateOpenBox();
			if (message !== "") {
				sap.m.MessageToast.show(message);
			} else {
				this._openDialog("OpenBoxDialog", "Open Box");
			}
		},

		_validateOpenBox: function () {
			var message;
			if (this.byId("TOUR").getValue() === "") {
				message = "No tour data selected";
			} else {
				var selectedItem = this.byId("table").getSelectedContexts();
				if (selectedItem.length === 0) {
					message = "To use this function, please select single BOX line";
				} else if (selectedItem.length > 1) {
					message = "To use this function, only select single BOX line at a time";
				} else {
					var itemObj = selectedItem[0].getObject();
					if (itemObj.UOM !== "BOX") {
						message = "This feature is only applicable for BOX";

					} else if (itemObj.ITEMNR === "000000") {
						message = "Please save this line to the unloading order before transferring to PC";
					} else {
						var oModel = new JSONModel();
						oModel.setData({
							matnr: itemObj.MATNR,
							maktx: itemObj.MAKTX,
							qty: ""
						});
						this.obdSelectedObject = itemObj;
						this.getView().setModel(oModel, "OpenBoxDialog");
						message = "";
					}
				}
			}

			return message;
		},

		onObdQtyLiveChange: function (oEvent) {
			this._checkInputQty(oEvent, "ObdQty");
		},

		_checkInputQty: function (oEvent, iId) {
			var value = oEvent.getParameter("value");
			if (value !== "") {
				if (value < 0) value = value * -1;
				value = Math.floor(value);
				if (!isNaN(value)) this.byId(iId).setValue(value);
			}
		},

		onObdOk: function () {
			var qty = this.byId("ObdQty").getValue();
			if (qty === "" || qty === "0") {
				sap.m.MessageToast.show("Please provide quantity");
			} else if (Number(this.obdSelectedObject.QTYV) === 0 && Number(qty) > Number(this.obdSelectedObject.QTYC)) {
				sap.m.MessageToast.show("Transferring more than Actual Qty is not allowed");
			} else if (Number(this.obdSelectedObject.QTYV) > 0 && Number(qty) > Number(this.obdSelectedObject.QTYD)) {
				sap.m.MessageToast.show("In case of Goods More, Transferring more than Plan Qty is not allowed");
			} else if (Number(this.obdSelectedObject.QTYV) < 0 && Number(qty) > Number(this.obdSelectedObject.QTYC)) {
				sap.m.MessageToast.show("In case of Goods Less, Transferring more than Actual Qty is not allowed");
			} else {
				this._convertOpenBox(qty);
				this.byId("OpenBoxDialog").destroy();
			}
		},

		_convertOpenBox: function (iQty) {
			var that = this;
			var qty = iQty;

			var oBusy = new sap.m.BusyDialog();
			this.onBusyS(oBusy);

			var oTable = this.getView().byId("table");
			var oModel2 = oTable.getModel();
			var aTableSearchState = [];
			this._applySearch(aTableSearchState);
			var aContexts = oTable.getItems();
			var itemData = [];

			var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
			oModel1.read("/OPENBOXSet(TOUR_ID='" + this.obdSelectedObject.TOUR_ID + "',MATNR='" + this.obdSelectedObject.MATNR + "',QTYC=" +
				qty + ")", {
					success: function (oData, oResponse) {
						var res = {};
						res = oData;

						if (res !== "") {
							for (var i = 0; i < aContexts.length; i++) {
								if (aContexts[i]._bGroupHeader === false) {
									var l_matnr = oModel2.getProperty("MATNR", aContexts[i].getBindingContext());
									var l_uom = oModel2.getProperty("UOM", aContexts[i].getBindingContext());
									var l_ret = oModel2.getProperty("RET", aContexts[i].getBindingContext());
									var itemRow = {
										COMP: oModel2.getProperty("COMP", aContexts[i].getBindingContext()),
										RET: oModel2.getProperty("RET", aContexts[i].getBindingContext()),
										MATNR: oModel2.getProperty("MATNR", aContexts[i].getBindingContext()),
										MAKTX: oModel2.getProperty("MAKTX", aContexts[i].getBindingContext()),
										UOM: oModel2.getProperty("UOM", aContexts[i].getBindingContext()),
										QTYD: oModel2.getProperty("QTYD", aContexts[i].getBindingContext()),
										QTYC: oModel2.getProperty("QTYC", aContexts[i].getBindingContext()),
										TOUR_ID: oModel2.getProperty("TOUR_ID", aContexts[i].getBindingContext()),
										ITEMNR: oModel2.getProperty("ITEMNR", aContexts[i].getBindingContext()),
										EAN11: oModel2.getProperty("EAN11", aContexts[i].getBindingContext()),
										VAL: oModel2.getProperty("VAL", aContexts[i].getBindingContext()),
										QTYV: oModel2.getProperty("QTYV", aContexts[i].getBindingContext())
									};
									// Material in BOX
									if (l_ret === "" && l_matnr === that.obdSelectedObject.MATNR && l_uom === that.obdSelectedObject.UOM) {
										itemRow.QTYD = that.obdSelectedObject.QTYD - qty;
										itemRow.QTYC = that.obdSelectedObject.QTYC - qty;
									}
									// Material in PC
									else if (l_ret === "" && l_matnr === that.obdSelectedObject.MATNR && l_uom === res.UOM) {
										itemRow.MATNR = res.MATNR;
										itemRow.MAKTX = res.MAKTX;
										itemRow.UOM = res.UOM;
										itemRow.ITEMNR = res.ITEMNR;
										itemRow.EAN11 = res.EAN11;
										itemRow.VAL = res.VAL;
										itemRow.QTYD = String(Number(itemRow.QTYD) + Number(res.CONV_QTY));
										itemRow.QTYC = String(Number(itemRow.QTYC) + Number(res.CONV_QTY));

										// Check if user changed the actual quantity that cause variance
										if (res.QTYV !== itemRow.QTYV) {
											itemRow.QTYC = String(Number(itemRow.QTYC) + (Number(itemRow.QTYV) - Number(res.QTYV)));
										}
										var l_existingFound = true;
									}
									itemData.push(itemRow);
								}
							}

							if (!l_existingFound) {
								itemRow = {
									COMP: res.COMP,
									RET: res.RET,
									MATNR: res.MATNR,
									MAKTX: res.MAKTX,
									UOM: res.UOM,
									QTYD: String(Number(res.QTYD) + Number(res.CONV_QTY)),
									QTYC: String(Number(res.QTYC) + Number(res.CONV_QTY)),
									TOUR_ID: res.TOUR_ID,
									ITEMNR: res.ITEMNR,
									EAN11: res.EAN11,
									VAL: res.VAL,
									QTYV: res.QTYV
								};
								itemData.push(itemRow);
							}

							oModel2.setData({
								data: itemData
							});
							oTable.removeSelections(true);
							oModel2.refresh(true);
						}
						sap.m.MessageToast.show(qty + " BOX have been successfully transferred to PC");
						that.onBusyE(oBusy);
					},
					error: function (oResponse) {
						that.onBusyE(oBusy);
						var oMsg = JSON.parse(oResponse.responseText);
						sap.m.MessageToast.show(oMsg.error.message.value);
					}
				});
		},

		onObdCancel: function () {
			this.byId("OpenBoxDialog").destroy();
		},
		/* =========================================================== */
		/* End of Open Box Feature									   */
		/* =========================================================== */

		onOkDialog: function (path) {
			var that = this;
			that.onRef();
			var input = that.getView().byId("FET").getValue();

			that.getView().byId("FET").focus();

			var qval = that.getView().byId("FETV").getValue(); //add

			if (input === "") {
				sap.m.MessageToast.show("Please provide EAN");
			} else {
				var oTable = this.byId("table");
				var oModel = oTable.getModel();
				var aItems = oModel.oData.data; //All rows  
				var flg = "";

				if (aItems !== undefined) {
					for (var iRowIndex1 = 0; iRowIndex1 < aItems.length; iRowIndex1++) {
						var l_ean = aItems[iRowIndex1].EAN11;
						var l_ret = aItems[iRowIndex1].VAL.substring(0, 3);
						if (l_ean === input && l_ret !== "RET") {
							flg = "X";
							break;
						}
					}
				}
				if (flg === "X") {
					sap.m.MessageToast.show("EAN already in the list");

					that.onSearch(that, l_ean); //added new

				} else {

					var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
					var itemData = oModel.getProperty("/data");
					var oBusy = new sap.m.BusyDialog();
					that.onBusyS(oBusy);

					oModel1.read("/MATERIALSet(MATNR='" + input + "',TOUR_ID='" + that.globalVar.tour_id + "',VRKME='')", {
						success: function (oData, oResponse) {

							var res = {};
							res = oData;

							if (res !== "") {
								var itemRow = {
									// MATNR: res.MATNR,
									// MAKTX: res.MAKTX,
									// VRKME: res.VRKME,
									// EAN11: res.EAN11,
									// KWMENG: qval, //added
									// NEW: "X",

									MATNR: res.MATNR,
									MAKTX: res.MAKTX,
									UOM: res.VRKME,
									// RET: res[iRowIndex].RET,
									QTYD: 0,
									QTYC: qval,
									TOUR_ID: res.TOUR_ID,
									ITEMNR: res.ITEMNR,
									EAN11: res.EAN11,
									// COMP: res[iRowIndex].COMP,
									VAL: res.VRKME,
									QTYV: 0
								};

								if (typeof itemData !== "undefined" && itemData.length > 0) {
									itemData.push(itemRow);
								} else {
									itemData = [];
									itemData.push(itemRow);
								}

								// // Set Model
								oModel.setData({
									data: itemData
								});
								oModel.refresh(true);
							}
							sap.m.MessageToast.show("Item " + res.MATNR + " added");

							//************************get values from backend based on filter Date*******************************************//
							that.onBusyE(oBusy);

						},
						error: function (oResponse) {
							that.onBusyE(oBusy);
							var oMsg = JSON.parse(oResponse.responseText);
							jQuery.sap.require("sap.m.MessageBox");
							sap.m.MessageToast.show(oMsg.error.message.value);
							that.byId("Dialog").destroy();
						}
					});
				}
			}

			that.getView().byId("FET").setValue();
			that.getView().byId("FETV").setValue();
			that.getView().byId("EDES").setValue();

			// that.byId("Dialog").destroy();
		},

		onCloseDialog: function () {
			var that = this;
			that.byId("Dialog").destroy();
			// that.byId("Dialog").close();

		},

		onTour: function (oEvent) {
			var that = this;
			var val = that.getView().byId("oSelect2").getSelectedKey();
			that.getView().byId("TOUR").setValue(val);

		},

		onEdes: function (oEvent) {
			var that = this;
			that.getView().byId("EDES").setValue();
			var viewFET = this.getView().byId("FET");
			if (typeof viewFET === "undefined") {
				viewFET = this.getView().byId("FETS");
			}
			var ean11Input = viewFET.getValue();
			if (ean11Input !== "") {
				var matListTable = that.getView().byId("materialListTable");
				var matListItems = matListTable.getItems();

				for (var iRowIndex = 0; iRowIndex < matListItems.length; iRowIndex++) {
					var maktx = matListItems[iRowIndex].getCells()[1].getText();
					var ean11Box = matListItems[iRowIndex].getCells()[2].getText();
					var ean11Pc = matListItems[iRowIndex].getCells()[3].getText();

					if (ean11Input === ean11Box || ean11Input === ean11Pc) {
						that.getView().byId("EDES").setValue(maktx);
					}
				}
			}
		},

		onblank: function (that) {
			//************************set blank values to table*******************************************//
			var oModel = that.getView().byId("table").getModel();
			var oTable = that.getView().byId("table");
			var data;
			var noData = oModel.getProperty("/data");
			this.byId("CbVirtual").setSelected(false);
			this.byId("CbFinal").setSelected(false);
			// oModel.setData({
			// 	modelData: noData
			// });
			oModel.setData({
				modelData: data
			});
			oModel.refresh(true);
			oTable.removeSelections(true);
		},

		onblankc: function (that) {
			//************************set blank values to table*******************************************//
			var oModel = that.getView().byId("oSelect2").getModel();
			var data;
			oModel.setData({
				modelData: data
			});
			oModel.refresh(true);
		},

		onClr: function (oEvent) {
			var that = this;
			that.getView().byId("TOUR").setValue();
			that.getView().byId("NMATNR").setValue();
			that.getView().byId("CONF").setSelected(false);
			that.getView().byId("CbDetail").setSelected(false);
			that.getView().byId("VAL").setValue();
			that.getView().byId("oSelect2").setSelectedKey();
			that.getView().byId("oSelect2").setEditable(true);
			that.onblank(that);
			that.onblankc(that);
		},

		onSer: function () {
			var that = this;
			var oView = that.getView();
			var tour = this.getView().byId("TOUR")._lastValue;
			if (tour === "") {
				sap.m.MessageToast.show("No tour data selected");
			} else {

				var oDialog = oView.byId("SDialog");
				// create dialog lazily
				if (!oDialog) {
					// create dialog via fragment factory
					oDialog = sap.ui.xmlfragment(oView.getId(), "com.baba.ZDSD_UNLOAD_V3.view.SDialog", this);
					// connect dialog to view (models, lifecycle)
					oView.addDependent(oDialog);
				}
				oDialog.setTitle("Search Item(Barcode)");

				oDialog.open(that);
			}

		},

		onSOkDialog: function (thatc) {
			var that = this;
			var input = that.getView().byId("FETS").getValue();
			that.onSearch(that, input);
			that.byId("Dialog").destroy();
			// that.byId("Dialog").close();
		},

		onGet: function (oEvent) {
			var that = this;
			var kunnr = that.getView().byId("oSelect1").getSelectedKey();
			var date = that.getView().byId("DATE").getValue();
			that.getView().byId("TOUR").setValue();
			that.getView().byId("NMATNR").setValue();
			that.getView().byId("CONF").setSelected(false);
			that.getView().byId("oSelect2").setEditable(true);

			if (kunnr === "" || date === "") {
				sap.m.MessageToast.show("Please provide Route & date");
			} else {
				var oModel = that.getView().byId("oSelect2").getModel();
				that.onRef(that);
				that.onblank(that);
				that.onblankc(that);
				// that.onGetM(kunnr, date, uncnf, oModel);

				var oBusy = new sap.m.BusyDialog();
				that.onBusyS(oBusy);

				// //************************filter Date*******************************************//

				// var vkunnr = "'" + kunnr + "'";
				// var vdate = "'" + date + "'";

				var PLFilters = [];
				PLFilters.push(new sap.ui.model.Filter({
					path: "KUNNR",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: kunnr
				}));
				PLFilters.push(new sap.ui.model.Filter({
					path: "PREVDAT",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: date
				}));

				//************************get values from backend based on filter Date*******************************************//

				var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
				// that.getView().setModel(oModel1);
				var itemData = oModel.getProperty("/data");

				oModel1.read("/TOURSet", {
					filters: PLFilters,
					success: function (oData, oResponse) {
						var res = [];
						res = oData.results;

						if (res.length > 0) {
							for (var iRowIndex = 0; iRowIndex < res.length; iRowIndex++) {
								var itemRow = {
									TOUR_ID: res[iRowIndex].TOUR_ID,
									TOUR_DATE: res[iRowIndex].TOUR_DATE
								};

								if (typeof itemData !== "undefined" && itemData.length > 0) {
									itemData.push(itemRow);
								} else {
									itemData = [];
									itemData.push(itemRow);
								}

							}

							// // Set Model
							oModel.setData({
								data: itemData
							});
							oModel.refresh(true);

							sap.m.MessageToast.show("Tour lists Fetched");
						} else {
							sap.m.MessageToast.show("No Tour lists found");
						}

						//************************get values from backend based on filter Date*******************************************//
						that.getView().byId("oSelect2").setSelectedKey();
						that.onBusyE(oBusy);

					},
					error: function (oResponse) {
						that.onBusyE(oBusy);
						var oMsg = JSON.parse(oResponse.responseText);
						jQuery.sap.require("sap.m.MessageBox");
						MessageBox.error(oMsg.error.message.value);
					}
				});

			}
		},

		onCal: function (oControlEvent) {

			var value = Number(oControlEvent.getSource().getProperty('value'));

			var valueState = isNaN(value) ? "Error" : "Success";
			oControlEvent.getSource().setValueState(valueState);

			if (valueState === "Success") {
				var oRow = oControlEvent.getSource().getParent();
				var NUM_DECIMAL_PLACES = 0;
				var aCells = oRow.getCells();
				// for (var i = 7; i < aCells.length; i++) {
				//var colVal_top = Number(parseInt(aCells[i].getValue()));
				var colVal_qtyc = aCells[6]._lastValue;

				if (Number(colVal_qtyc) < 0) {
					colVal_qtyc = "0";
				}
				var colVal_qtyd = aCells[5]._lastValue;
				var colVal_qtyv = aCells[7]._lastValue;

				// Begin of Version 3
				var l_ret = aCells[4].getProperty("text");
				if (l_ret === "1" && Number(colVal_qtyc) > Number(colVal_qtyd)) {
					sap.m.MessageBox.error("Goods More is not allowed for Return Items");
					colVal_qtyc = Number(colVal_qtyd) + Number(colVal_qtyv);
					aCells[6].setValue(colVal_qtyc);
				} else if (l_ret === "2" && colVal_qtyc !== colVal_qtyd) {
					sap.m.MessageBox.error("Goods More/Goods Less is not allowed for Damaged Items");
					aCells[6].setValue(colVal_qtyd);
				} else {
					// End of Version 3

					colVal_qtyd = Number(colVal_qtyd);

					if (colVal_qtyc === "" || colVal_qtyc === "0" || colVal_qtyc === "0.000") {
						var colVal_tar0 = "0";
						//colVal_tar0 = parseInt(colVal_tar0);
						colVal_tar0 = Number(colVal_tar0);
					} else {
						var input1 = colVal_qtyc.split(".");
						var input = input1[0];

						var convval = Number(input).toFixed(NUM_DECIMAL_PLACES);
						colVal_tar0 = Number(convval);
						// colVal_tar0 = Number(colVal_qtyc).toFixed(NUM_DECIMAL_PLACES);
					}

					var diff = Number(colVal_tar0) - colVal_qtyd; //count - plan

					aCells[6].setValue(colVal_tar0);
					aCells[7].setValue(diff);

					this.onUpdateFinished();

				}
				// }
			}
		},

		onGetV: function (oEvent) {
			var that = this;
			var kunnr = that.getView().byId("oSelect1").getSelectedKey();
			var date = that.getView().byId("DATE").getValue();
			var uncnf = "";
			var tour = this.getView().byId("TOUR")._lastValue;
			if (tour === "") {
				sap.m.MessageToast.show("No tour data selected");
			} else {

				if (kunnr === "" || date === "") {
					sap.m.MessageToast.show("Please provide Route & date");
				} else {
					var oModel = that.getView().byId("table").getModel();
					that.onRef(that);
					that.onblank(that);

					that.onGetM(kunnr, date, uncnf, oModel);
				}
			}
		},

		onFet: function (oEvent) {
			var that = this;
			var kunnr = that.getView().byId("oSelect1").getSelectedKey();
			var date = that.getView().byId("DATE").getValue();
			var uncnf = "";
			var tour = this.getView().byId("TOUR")._lastValue;
			this.globalVar.tour_id = tour;
			if (tour === "") {
				sap.m.MessageToast.show("No tour data selected");
			} else {

				if (kunnr === "" || date === "") {
					sap.m.MessageToast.show("Please provide Route & date");
				} else {
					var oModel = that.getView().byId("table").getModel();
					// that.onRef(that);
					this.globalVar.isFetching = true;
					that.onblank(that);
					that.onGetM(kunnr, date, uncnf, oModel);
				}
			}
		},

		onUnc: function (oEvent) {
			var that = this;
			var kunnr = that.getView().byId("oSelect1").getSelectedKey();
			var date = that.getView().byId("DATE").getValue();
			var uncnf = "X";
			var tour = this.getView().byId("TOUR")._lastValue;
			if (tour === "") {
				sap.m.MessageToast.show("No tour data selected");
			} else {

				if (kunnr === "" || date === "") {
					sap.m.MessageToast.show("Please provide Route & date");
				} else {
					var oModel = that.getView().byId("table").getModel();
					that.onRef(that);
					that.onblank(that);

					var oView = that.getView();
					var oDialog = oView.byId("PDialog");
					// create dialog lazily
					if (!oDialog) {
						// create dialog via fragment factory
						oDialog = sap.ui.xmlfragment(oView.getId(), "com.baba.ZDSD_UNLOAD_V3.view.PDialog", this);
						// connect dialog to view (models, lifecycle)
						oView.addDependent(oDialog);
					}
					oDialog.setTitle("Search Pending Items");
					oDialog.open();

					// that.onGetM(kunnr, date, uncnf, oModel);
				}
			}
		},

		onPOkDialog: function () {
			var that = this;

			var alla = that.getView().byId("ALLA").getSelected();
			var boxa = that.getView().byId("BOXA").getSelected();
			var pca = that.getView().byId("PCA").getSelected();
			var reta = that.getView().byId("RETA").getSelected();
			var traa = that.getView().byId("TRAA").getSelected();

			var kunnr = that.getView().byId("oSelect1").getSelectedKey();
			var date = that.getView().byId("DATE").getValue();
			var uncnf = "X";
			var oModel = that.getView().byId("table").getModel();

			if (alla === true) {
				var val = "A";
			} else if (boxa === true) {
				val = "B";
			} else if (pca === true) {
				val = "P";
			} else if (reta === true) {
				val = "R";
			} else if (traa === true) {
				val = "T";
			}
			that.onGetM(kunnr, date, uncnf, oModel, val);

			that.byId("Dialog").destroy();

		},

		onAll: function (oEvent) {
			var that = this;
			var kunnr = that.getView().byId("oSelect1").getSelectedKey();
			var date = that.getView().byId("DATE").getValue();
			var uncnf = "X";
			var tour = this.getView().byId("TOUR")._lastValue;
			if (tour === "") {
				sap.m.MessageToast.show("No tour data selected");
			} else {

				if (kunnr === "" || date === "") {
					sap.m.MessageToast.show("Please provide Route & date");
				} else {
					var oModel = that.getView().byId("table").getModel();
					that.onRef(that);
					that.onblank(that);

					var oView = that.getView();
					var oDialog = oView.byId("PDialog");
					// create dialog lazily
					if (!oDialog) {
						// create dialog via fragment factory
						oDialog = sap.ui.xmlfragment(oView.getId(), "com.baba.ZDSD_UNLOAD_V3.view.ADialog", this);
						// connect dialog to view (models, lifecycle)
						oView.addDependent(oDialog);
					}
					oDialog.setTitle("Search All Items");
					oDialog.open();

					// that.onGetM(kunnr, date, uncnf, oModel);
				}
			}
		},

		onAOkDialog: function () {
			var that = this;

			var alla = that.getView().byId("ALLAA").getSelected();
			var boxa = that.getView().byId("BOXAA").getSelected();
			var pca = that.getView().byId("PCAA").getSelected();
			var reta = that.getView().byId("RETAA").getSelected();
			var brka = that.getView().byId("BRKAA").getSelected();

			var kunnr = that.getView().byId("oSelect1").getSelectedKey();
			var date = that.getView().byId("DATE").getValue();
			var uncnf = "";
			var oModel = that.getView().byId("table").getModel();

			if (alla === true) {
				var val = "A";
			} else if (boxa === true) {
				val = "B";
			} else if (pca === true) {
				val = "P";
			} else if (reta === true) {
				val = "R";
			} else if (brka === true) {
				val = "T";
			}
			that.onGetM(kunnr, date, uncnf, oModel, val);
			that.byId("ADialog").destroy();

		},

		onGetM: function (kunnr, date, unconf, oModel, val) {
			var that = this;
			var oBusy = new sap.m.BusyDialog();
			that.onBusyS(oBusy);
			var tour = that.getView().byId("TOUR")._lastValue;

			var aTableSearchState = [];
			that._applySearch(aTableSearchState);

			// //************************filter Date*******************************************//
			var PLFilters = [];

			PLFilters.push(new sap.ui.model.Filter({
				path: "KUNNR",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: kunnr
			}));
			PLFilters.push(new sap.ui.model.Filter({
				path: "UNCONF",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: unconf
			}));
			PLFilters.push(new sap.ui.model.Filter({
				path: "PREVDAT",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: date
			}));
			
			PLFilters.push(new sap.ui.model.Filter({
				path: "VAL",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: val
			}));

			PLFilters.push(new sap.ui.model.Filter({
				path: "TOUR_ID",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: tour
			}));
			
			var flose = "'" + this.globalVar.MDT_FLOSE + "'";
			PLFilters.push(new sap.ui.model.Filter({
				path: "IS_FINAL",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: flose
			}));

			//************************get values from backend based on filter Date*******************************************//

			var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
			// that.getView().setModel(oModel1);
			var itemData = oModel.getProperty("/data");

			oModel1.read("/INPUTSet", {
				filters: PLFilters,
				success: function (oData, oResponse) {
					var res = [];
					res = oData.results;

					if (res.length > 0) {
						// Begin of Version 3
						that.globalVar.adminPass = res[0].BCODE;
						var viewModel = that.getView().getModel("worklistView");
						if (res[0].RESET_ACT !== "") {
							var resetBtnVisibility = true;
						} else {
							resetBtnVisibility = false;
						}
						viewModel.setProperty("/resetBtnVisibility", resetBtnVisibility);
						that.oViewModel.setProperty("/resetBtnVisibility", resetBtnVisibility);
						that.getView().setModel("worklistView", viewModel);
						// End of Version 3

						that.globalVar.IS_MDT = res[0].IS_MDT;
						that.globalVar.MDT_VCHECKIN = res[0].MDT_VCHECKIN;
						that.globalVar.MDT_FLOSE = res[0].MDT_FLOSE;

						if (that.globalVar.isFetching) {
							that.globalVar.isFetching = false;
							if (that.globalVar.IS_MDT === "X" && that.globalVar.MDT_VCHECKIN === "" && that.globalVar.MDT_FLOSE === "") {
								that._openDialog("MDT", "Select MDT Transaction Type");
							} else {
								that.byId("CbVirtual").setSelected(false);
								that.byId("CbFinal").setSelected(false);
								if (that.globalVar.MDT_VCHECKIN === "X") that.byId("CbVirtual").setSelected(true);
								else if (that.globalVar.MDT_FLOSE === "X") that.byId("CbFinal").setSelected(true);
							}

							if (that.globalVar.IS_MDT === "X") {
								that.oViewModel.setProperty("/CbVirtual/visible", true);
								that.oViewModel.setProperty("/CbFinal/visible", true);
							} else {
								that.oViewModel.setProperty("/CbVirtual/visible", false);
								that.oViewModel.setProperty("/CbFinal/visible", false);
							}
							that.getView().setModel("worklistView", that.oViewModel);
						}

						for (var iRowIndex = 0; iRowIndex < res.length; iRowIndex++) {
							var itemRow = {
								MATNR: res[iRowIndex].MATNR,
								MAKTX: res[iRowIndex].MAKTX,
								UOM: res[iRowIndex].UOM,
								RET: res[iRowIndex].RET,
								QTYD: res[iRowIndex].QTYD,
								QTYC: res[iRowIndex].QTYC,
								TOUR_ID: res[iRowIndex].TOUR_ID,
								ITEMNR: res[iRowIndex].ITEMNR,
								EAN11: res[iRowIndex].EAN11,
								COMP: res[iRowIndex].COMP,
								VAL: res[iRowIndex].VAL,
								QTYV: res[iRowIndex].QTYV

							};

							if (iRowIndex === 0) {
								that.getView().byId("TOUR").setValue(res[iRowIndex].TOUR_ID);
							}

							if (typeof itemData !== "undefined" && itemData.length > 0) {
								itemData.push(itemRow);
							} else {
								itemData = [];
								itemData.push(itemRow);
							}

						}
					}

					// // Set Model
					oModel.setData({
						data: itemData
					});
					oModel.refresh(true);

					that.getView().byId("VAL").setValue(val);

					if (unconf === "X") {
						sap.m.MessageToast.show("Pending Items Fetched");
					} else {
						that.getView().byId("oSelect2").setEditable(false);
						sap.m.MessageToast.show("Items Fetched");
					}

					//************************get values from backend based on filter Date*******************************************//
					that.onBusyE(oBusy);

				},
				error: function (oResponse) {
					that.onBusyE(oBusy);
					var oMsg = JSON.parse(oResponse.responseText);
					jQuery.sap.require("sap.m.MessageBox");
					MessageBox.error(oMsg.error.message.value);
					// sap.m.MessageToast.show(oMsg.error.message.value);
				}
			});
		},

		onTick: function () {
			var oTable = this.getView().byId("table");
			var aItems = oTable.getItems(); //All rows  
			var oModel = oTable.getModel();

			if (aItems.length > 0) {

				for (var iRowIndex = 0; iRowIndex < aItems.length; iRowIndex++) {
					if (aItems[iRowIndex]._bGroupHeader === false) {
						// var l_matnr = oModel.getProperty("MATNR", aItems[iRowIndex].getBindingContext());
						// if (l_matnr !== "" && l_matnr !== undefined && l_matnr !=== null ) {
						var l_comp = oModel.getProperty("COMP", aItems[iRowIndex].getBindingContext());
						var l_qtyd = oModel.getProperty("QTYD", aItems[iRowIndex].getBindingContext()); // Version 3
						if (l_comp === "X" || l_qtyd < 0) {
							aItems[iRowIndex].getCells()[6].setEditable(false);
						}
					}
				}
			}

		},

		onRest: function () {
			var oTable = this.getView().byId("table");
			var oModel = oTable.getModel();
			var aItems = oTable.getSelectedItems(); //All rows  ; //All rows  

			if (aItems.length > 0) {

				for (var iRowIndex = 0; iRowIndex < aItems.length; iRowIndex++) {
					if (aItems[iRowIndex]._bGroupHeader === false) {

						var l_qtyd = oModel.getProperty("QTYD", aItems[iRowIndex].getBindingContext());
						if (l_qtyd >= 0) {
							aItems[iRowIndex].getCells()[6].setEditable(true);
						}
						// aItems[iRowIndex].getCells()[0].setIcon();
						// aItems[iRowIndex].getCells()[0].setText();

					}
				}
			}
		},

		onSearch0: function (oEvent) { //search by item 0
			var aTableSearchState = [];
			var sQuery = "0"; //oEvent.getParameter("query");

			if (sQuery && sQuery.length > 0) {
				aTableSearchState = [new Filter("QTYC", FilterOperator.GT, sQuery)];
				//new Filter("MATNR", FilterOperator.Contains, sQuery.toUpperCase())
			}
			this._applySearch(aTableSearchState);
		},

		///////////////////////
		// onSearchM: function (event) {
		// 	var item = event.getParameter("suggestionItem");
		// 	if (item) {
		// 		sap.m.MessageToast.show(item.getText() + " selected");
		// 	}
		// },

		onSuggestM: function (event) {
			//////add
			var oView = this.getView();
			oView.setModel(this.oModel);
			this.oSearchField = oView.byId("searchField");
			//////add
			var sQuery = event.getParameter("suggestValue");
			var aFilters = [];
			if (sQuery) {
				aFilters = new Filter({
					filters: [
						new Filter("MATNR", FilterOperator.Contains, sQuery),
						new Filter("MATNR", FilterOperator.Contains, sQuery.toUpperCase()),
						new Filter("MAKTX", FilterOperator.Contains, sQuery),
						new Filter("MAKTX", FilterOperator.Contains, sQuery.toUpperCase())

					],
					and: false
				});
			}

			this.oSearchField.getBinding("suggestionItems").filter(aFilters);
			this.oSearchField.suggest();
		},

		onDchk: function (oEvent) {
			var value = oEvent.getSource().getProperty('value');
			var nval = Number(value);
			if (value === "") {
				this.byId("FETV").setValue(0);
			} else if (nval < 0) {
				this.byId("FETV").setValue(0);
			} else {
				var input1 = value.split(".");
				var input = input1[0];

				var convval = Number(input).toFixed(0);
				this.byId("FETV").setValue(convval);

			}
		},

		onMCloseDialog: function () {
			// var that = this;
			var oTable = this.byId("table");
			oTable.getBinding("items").refresh();

			var that = this;
			that.byId("MDialog").destroy();
			// that.byId("Dialog").close();

			// // added
			// var aTableSearchState = [];
			// 	var sQuery = "NEW"; //oEvent.getParameter("query");

			// 	if (sQuery && sQuery.length > 0) {
			// 		aTableSearchState = [new Filter("VAL", FilterOperator.Contains, sQuery)];
			// 		//new Filter("MATNR", FilterOperator.Contains, sQuery.toUpperCase())
			// 	}
			// 	this._applySearch(aTableSearchState);
			// // added

		},

		onSave1: function (oEvent) {
			var that = this;
			var fconf = that.getView().byId("CONF").getSelected();
			if (fconf === true) {
				if (this.globalVar.MDT_VCHECKIN === "X") {
					var msg =
						"You are doing VIRTUAL CHECK-IN and FINAL CONFIRMATION. All your changes will be discarded and system will save the unloading with Default values only. Do you want to continue?";
				} else {
					msg = "Do you want to close the Unloading Process?";
				}
				MessageBox.warning(
					msg, {
						actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
						onClose: function (sAction) {
							if (sAction === "OK") {
								that.onSave(oEvent);
							}
						}
					}
				);
			} else {
				if (this.globalVar.MDT_VCHECKIN === "X") {
					msg =
						"You are doing VIRTUAL CHECK-IN. All your changes will be discarded and system will save the unloading with Default values only. Do you want to continue?";
					MessageBox.warning(
						msg, {
							actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
							onClose: function (sAction) {
								if (sAction === "OK") {
									that.onSave(oEvent);
								}
							}
						}
					);
				} else {
					that.onSave(oEvent);
				}
			}
		},

		///////////////////////////////////
		onSave: function (oEvent) {
			var that = this;
			var oTable = that.getView().byId("table");
			var oModel = oTable.getModel();

			var tour = this.getView().byId("TOUR")._lastValue;
			if (tour === "") {
				sap.m.MessageToast.show("No tour data selected");
			} else {

				var oBusy = new sap.m.BusyDialog();
				that.onBusyS(oBusy);

				var aTableSearchState = [];
				that._applySearch(aTableSearchState);

				// Get Items of the Table
				var aItems = oTable.getItems(); //All rows  

				// var aContexts = oTable.getSelectedContexts(); //selected rows marked with checkbox

				if (aItems.length > 0) {

					// Define an empty Array
					var itemData = [];
					var aContexts = oTable.getSelectedContexts(); //selected rows marked with checkbox

					for (var iRowIndex = 0; iRowIndex < aItems.length; iRowIndex++) {
						//var l_chk = oModel.getProperty("CHK", aItems[iRowIndex].getBindingContext());	
						var l_matnr = oModel.getProperty("MATNR", aItems[iRowIndex].getBindingContext());
						if (l_matnr !== "" && l_matnr !== null) {
							var l_uom = oModel.getProperty("UOM", aItems[iRowIndex].getBindingContext());
							var l_tourid = oModel.getProperty("TOUR_ID", aItems[iRowIndex].getBindingContext());
							var l_itemnr = oModel.getProperty("ITEMNR", aItems[iRowIndex].getBindingContext());
							var l_qtyd = oModel.getProperty("QTYD", aItems[iRowIndex].getBindingContext());
							var l_qtyc = oModel.getProperty("QTYC", aItems[iRowIndex].getBindingContext());
							var l_qtyv = oModel.getProperty("QTYV", aItems[iRowIndex].getBindingContext());
							var l_ret = oModel.getProperty("RET", aItems[iRowIndex].getBindingContext());
							var l_chk = oModel.getProperty("COMP", aItems[iRowIndex].getBindingContext());
							// Begin of Version 3
							var l_val = oModel.getProperty("VAL", aItems[iRowIndex].getBindingContext());
							var l_chgReas = l_val.substring(4, 6);
							var l_regex = /^[RD]/;
							if (!l_regex.test(l_chgReas)) {
								l_chgReas = "";
							}
							// End of Version 3
							// var chk = aItems[iRowIndex].getCells()[0].getSelected();
							// if (chk === true) {
							// 	var l_mark = "X";
							// }
							if (l_qtyc === "") {
								l_qtyc = 0;
							}

							var no = "0";
							var valn = Number(l_qtyc).toFixed(no);
							l_qtyc = valn;

							itemData.push({
								TOUR_ID: l_tourid,
								ITEMNR: l_itemnr,
								MATNR: l_matnr,
								UOM: l_uom,
								QUAN_PLAN: String(l_qtyd),
								QUAN_COUNT: String(l_qtyc),
								SPEC_RETURN: l_ret,
								// Begin of Version 3
								CHG_REAS: l_chgReas,
								QUAN_DIFF: String(l_qtyv),
								// End of Version 3
								STATUS: l_chk
							});
						}
					}

					if (aContexts.length > 0) {
						for (var iRowIndex1 = 0; iRowIndex1 < aContexts.length; iRowIndex1++) {
							// l_matnr = oModel.getProperty("MATNR", aContexts[iRowIndex1].getBindingContext());
							// l_itemnr = oModel.getProperty("ITEMNR", aContexts[iRowIndex1].getBindingContext());
							var oThisObj = aContexts[iRowIndex1].getObject();

							l_chgReas = oThisObj.VAL.substring(4, 6);
							if (!l_regex.test(l_chgReas)) {
								l_chgReas = "";
							}

							itemData.push({
								ITEMNR: oThisObj.ITEMNR,
								MATNR: oThisObj.MATNR,
								UOM: oThisObj.UOM,
								// Begin of Version 3
								SPEC_RETURN: oThisObj.RET,
								CHG_REAS: l_chgReas,
								// End of Version 3
								STATUS: "X"
							});

						}
					}

					var val = that.getView().byId("CONF").getSelected();
					if (val === true) {
						var l_mark1 = "X";
					} else {
						l_mark1 = "";
					}

					// Create one emtpy Object
					var oEntry1 = {};
					oEntry1.TOUR_ID = that.getView().byId("TOUR").getValue();
					oEntry1.CONF = l_mark1;
					oEntry1.ROUTE = that.getView().byId("oSelect1").getSelectedKey();
					oEntry1.VAL = that.getView().byId("VAL").getValue();

					oEntry1.IS_MDT = that.globalVar.IS_MDT;
					oEntry1.MDT_VCHECKIN = that.globalVar.MDT_VCHECKIN;
					oEntry1.MDT_FLOSE = that.globalVar.MDT_FLOSE;

					//Using Deep entity the data is posted as shown below .
					oEntry1.HEADITEMNAV = itemData;

					var oModel2 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);

					oModel2.create("/HEADERSet", oEntry1, {
						success: function (oData, oResponse) {
							if (l_mark1 === "X") {
								that.onblank(that);
								that.onPri();
								that.getView().byId("CONF").setSelected(false);
								that.getView().byId("TOUR").setValue();
								that.getView().byId("oSelect2").setSelectedKey();
							} else {
								that.onFet();
							}

							// var val12 = oData.HEADITEMNAV.results[0].SERVQUOT;
							sap.m.MessageToast.show("Saved Successfully");
							that.onBusyE(oBusy);
						},
						error: function (oResponse) {
							that.onBusyE(oBusy);
							var oMsg = JSON.parse(oResponse.responseText);
							jQuery.sap.require("sap.m.MessageBox");
							sap.m.MessageToast.show(oMsg.error.message.value);

						}

					});

				} else {
					sap.m.MessageToast.show("No Data for Posting");

				}
			}
		},

		onPri: function () {
			// Begin of Version 3
			var printDetail = this.byId("CbDetail").getSelected();
			// End of Version 3
			this._printForm("", "", printDetail);
			// var tour = this.getView().byId("TOUR")._lastValue;
			// if (tour === "") {
			// 	sap.m.MessageToast.show("No tour data for Print");
			// } else {

			// 	var url = "/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/PRINTSet('" + tour + "')/$value";
			// 	// // var url = "test/Capture.JPG";
			// 	sap.m.URLHelper.redirect(url, true);
			// 	// 	var hContent = '<html><head></head><body>';
			// 	// var bodyContent = $(".printAreaBox").html();
			// 	// var closeContent = "</body></html>";
			// 	// var htmlpage = hContent + bodyContent + closeContent;

			// 	// 		cordova.plugins.printer.print(htmlpage, {
			// 	// 				duplex: 'long'
			// 	// 			}, function(res) {
			// 	// 				alert(res ? 'Done' : 'Canceled');
			// 	// 			});
			// }
			// window.print();
			// new sap.m.Link(url, true);

			// 	var oTarget = this.getView();
			// 	// sTargetId = oEvent.getSource().data("targetId");

			// 	// if (sTargetId) {
			// 	//     oTarget = oTarget.byId(sTargetId);
			// 	// }

			// 	if (oTarget) {
			// 		var $domTarget = oTarget.$()[0],
			// 			sTargetContent = $domTarget.innerHTML,
			// 			sOriginalContent = document.body.innerHTML;

			// 		document.body.innerHTML = sTargetContent;
			// 		window.print();
			// 		document.body.innerHTML = sOriginalContent;
			// 	} else {
			// 		jQuery.sap.log.error("onPrint needs a valid target container [view|data:targetId=\"SID\"]");
			// 	}
			// }
		},

		onPrintItemized: function () {
			if (this.byId("TOUR").getValue() === "") {
				sap.m.MessageToast.show("No tour data selected");
			} else {
				this._openDialog("PrintItemizedDialog", "Select UoM");
			}
		},

		onPrintItemizedOk: function (oEvent) {
			if (this.byId("BOXA").getSelected()) {
				var selectedUom = "0";
			} else if (this.byId("PCA").getSelected()) {
				selectedUom = "1";
			} else if (this.byId("RETA").getSelected()) {
				selectedUom = "2";
			} else if (this.byId("TRAA").getSelected()) {
				selectedUom = "3";
			}
			// Begin of Version 3
			var printDetail = this.byId("CbDetail").getSelected();
			// End of Version 3
			this.byId("PrintItemizedDialog").close();
			this._printForm(oEvent, selectedUom, printDetail);
		},

		_printForm: function (oEvent, iUom, iDetail) {
			var tour = this.getView().byId("TOUR")._lastValue;

			if (iDetail) {
				iDetail = "X";
			} else {
				iDetail = "";
			}

			if (tour === "") {
				sap.m.MessageToast.show("No tour data for Print");
			} else {
				var url = "/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/PRINTSet(TOUR_ID='" + tour + "',UOM='" + iUom + "',DET='" + iDetail +
					"')/$value";
				sap.m.URLHelper.redirect(url, true);
			}
		},

		onPrintItemizedClose: function () {
			this.byId("PrintItemizedDialog").close();
		},

		onSearchN: function (oEvent) { //search by item 0
			var aTableSearchState = [];
			var sQuery = "000000"; //oEvent.getParameter("query");

			var flg = "";
			var oTable = this.byId("table");
			var oModel = oTable.getModel();
			var aItems = oModel.oData.data; //All rows  

			for (var iRowIndex1 = 0; iRowIndex1 < aItems.length; iRowIndex1++) {
				var l_itemnr = aItems[iRowIndex1].ITEMNR;
				if (l_itemnr === sQuery) {
					flg = "X";
					break;
				}
			}

			if (flg === "X") {
				// if (sQuery && sQuery.length > 0) {
				aTableSearchState = [new Filter("ITEMNR", FilterOperator.Contains, sQuery)];
				//new Filter("MATNR", FilterOperator.Contains, sQuery.toUpperCase())
				// }
				this._applySearch(aTableSearchState);
			} else {
				sap.m.MessageToast.show("No new Item added in list");
			}
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Triggered by the table's 'updateFinished' event: after new table
		 * data is available, this handler method updates the table counter.
		 * This should only happen if the update was successful, which is
		 * why this handler is attached to 'updateFinished' and not to the
		 * table's list binding's 'dataReceived' method.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */

		//oncal: function (oEvent){
		//		var value = Number(oControlEvent.getSource().getProperty('value'));

		//},

		onUpdateFinished: function (oEvent) {
			var that = this;
			// 	// update the worklist's object counter after the table update
			// 	// var sTitle,
			// 	// 	oTable = oEvent.getSource(),
			// 	// 	iTotalItems = oEvent.getParameter("total");
			// 	// // only update the counter if the length is final and
			// 	// // the table is not empty
			// 	// if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
			// 	// 	sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
			// 	// } else {
			// 	// 	sTitle = this.getResourceBundle().getText("worklistTableTitle");
			// 	// }
			// 	// this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
			var oTable = this.getView().byId("table");
			var oModel = oTable.getModel();

			var aItemsO = oModel.oData.data; //All rows  

			// Get Items of the Table
			var aItems = oTable.getItems(oModel);
			var l_qtyb = 0,
				l_cntb = 0,
				l_qtyp = 0,
				l_cntp = 0,
				l_qtyr = 0,
				no = 0,
				l_cntr = 0;
			for (var iRowIndex = 0; iRowIndex < aItems.length; iRowIndex++) {
				var l_val = oModel.getProperty("VAL", aItems[iRowIndex].getBindingContext());
				var l_qtyc = oModel.getProperty("QTYC", aItems[iRowIndex].getBindingContext());
				if ((l_val === "" || l_qtyc === "") && (l_val === undefined || l_qtyc === undefined)) {
					l_qtyc = 0;
				} else {
					var val = Number(l_qtyc).toFixed(no);
					var cval = Number(val);
				}
				if (l_val === "BOX") {
					l_qtyb = l_qtyb + cval;
					if (cval > 0) {
						l_cntb = l_cntb + 1;
					}
				}
				if (l_val === "PC") {
					l_qtyp = l_qtyp + cval;
					if (cval > 0) {
						l_cntp = l_cntp + 1;
					}
				}
				// Begin of Version 3
				if (l_val !== null && l_val !== "") {
					var l_valret = l_val.substring(0, 3);
					if (l_valret === "RET") {
						l_qtyr = l_qtyr + cval;
						if (cval > 0) {
							l_cntr = l_cntr + 1;
						}
					}
				}
				// End of Version 3
			}

			var box = l_qtyb + "/" + l_cntb;
			var pc = l_qtyp + "/" + l_cntp;
			var ret = l_qtyr + "/" + l_cntr;
			that.getView().byId("BOXV").setValue(box);
			that.getView().byId("PCV").setValue(pc);
			that.getView().byId("RETV").setValue(ret);

			// var aItems = oTable1.getItems();
			// if (aItems && aItems.length > 0) {
			// 	for (var i = 0; i < aItems.length; i++) {
			// 		var aCells = aItems[i].getCells();
			// 		if (aCells[1].getText() === "UOM") {
			// 			//you can set the style via Jquery
			// 			//$("#" + aItems[i].getId()).css("background-color", "red");
			// 			//or add the style
			// 			aItems[i].addStyleClass('yellow');
			// 		}
			// 	}
			// }
			// var a = oTable1.getModel();
			// a.refresh(true);
			that.onTick();
		},

		onAfterRendering: function () {
			// 	// var tabData = sap.ui.getCore().byId("table").getModel();
			// 	// var tabDataLength = tabData.length;
			// 	// var colId = "";
			// 	// var colValue = "";
			// 	// for (var i = 0; i < tabDataLength; i++) {
			// 	// 	colId = "UOM-__clone" + i;
			// 	// 	colValue = sap.ui.getCore().byId(colId).getText();
			// 	// 	// colValue = parseInt(colValue);
			// 	// 	if (colValue === "BOX" ) {
			// 	// 		sap.ui.getCore().byId(colId).addStyleClass("red");
			// 	// 		sap.ui.getCore().byId(colId).removeStyleClass("green");
			// 	// 		sap.ui.getCore().byId(colId).removeStyleClass("yellow");
			// 	// 	} else if (colValue >= 100 && colValue < 200) {
			// 	// 		sap.ui.getCore().byId(colId).addStyleClass("yellow");
			// 	// 		sap.ui.getCore().byId(colId).removeStyleClass("red");
			// 	// 		sap.ui.getCore().byId(colId).removeStyleClass("green");
			// 	// 	} else if (colValue >= 200) {
			// 	// 		sap.ui.getCore().byId(colId).addStyleClass("green");
			// 	// 		sap.ui.getCore().byId(colId).removeStyleClass("yellow");
			// 	// 		sap.ui.getCore().byId(colId).removeStyleClass("red");
			// 	// 	}
			// 	// }

			// 	var oTable1 = this.getView().byId("table");
			// // 	var aItems = oTable1.getItems();
			// // 	if (aItems && aItems.length > 0) {
			// // 		for (var i = 0; i < aItems.length; i++) {
			// // 			var aCells = aItems[i].getCells();
			// // 			if (aCells[1].getText() === "UOM") {
			// // 				//you can set the style via Jquery
			// // 				//$("#" + aItems[i].getId()).css("background-color", "red");
			// // 				//or add the style
			// // 				aItems[i].addStyleClass("green");
			// // 			}
			// // 		}
			// // 	}
			// 	var a = oTable1.getModel();
			// 	a.refresh(true);
		},

		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPress: function (oEvent) {
			// The source is the list item that got pressed
			this._showObject(oEvent.getSource());
		},

		/**
		 * Event handler for navigating back.
		 * We navigate back in the browser historz
		 * @public
		 */
		onNavBack: function () {
			history.go(-1);
		},

		onSearch: function (oEvent, input) { //search by EAN

			this.onRef();
			var flg = "";
			var oTable = this.byId("table");
			var oModel = oTable.getModel();
			var aItems = oModel.oData.data; //All rows  

			// var aItems = oTable.getItems(); //All rows  
			if (aItems === undefined) {
				sap.m.MessageToast.show("No Item to search");
			} else {
				if (aItems !== undefined) {
					for (var iRowIndex1 = 0; iRowIndex1 < aItems.length; iRowIndex1++) {
						// var l_ean11 = oModel.getProperty("EAN11", aItems[iRowIndex1].getBindingContext());
						var l_ean11 = aItems[iRowIndex1].EAN11;
						if (l_ean11 === input) {
							flg = "X";
							break;
						}
					}
				}
			}

			if (flg === "X") {
				// this.getView().byId("searchField").setValue(input);
				var aTableSearchState = [];
				var sQuery = input; //oEvent.getParameter("query");

				if (sQuery && sQuery.length > 0) {
					aTableSearchState = [new Filter("EAN11", FilterOperator.Contains, sQuery)];
					//new Filter("MATNR", FilterOperator.Contains, sQuery.toUpperCase())
				}
				this._applySearch(aTableSearchState);
			} else {
				sap.m.MessageToast.show("Item doesn't exit in list");
			}

		},

		// onSearchA: function (oEvent, input) {
		// 	if (oEvent.getParameters().refreshButtonPressed) {
		// 		// Search field's 'refresh' button has been pressed.
		// 		// This is visible if you select any master list item.
		// 		// In this case no new search is triggered, we only
		// 		// refresh the list binding.
		// 		this.onRefresh();
		// 	} else {
		// 		//if (input !== ""){
		// 		var aTableSearchState = [];
		// 		var sQuery = oEvent.getParameter("query");

		// 		if (sQuery && sQuery.length > 0) {
		// 			aTableSearchState = [new Filter("EAN11", FilterOperator.Contains, sQuery)];
		// 		}
		// 		this._applySearch(aTableSearchState);
		// 		// }else{var oTable = this.byId("table");
		// 		//          	oTable.getBinding("items").refresh();
		// 		//     }
		// 	}

		// },

		onSearchA: function (oEvent) { //search by material
			this.onRef(this, "X");
			// var input = oEvent.getParameter("query");

			var input0 = oEvent.getParameter("query");
			var input1 = input0.split(" - ");
			var input = input1[0];

			var flg = "";
			var oTable = this.byId("table");
			var oModel = oTable.getModel();
			var aItems = oModel.oData.data; //All rows  

			if (input !== "") {
				// var aItems = oTable.getItems(); //All rows  
				if (aItems === undefined) {
					sap.m.MessageToast.show("No Item to search");
				} else {
					if (aItems !== undefined) {
						for (var iRowIndex1 = 0; iRowIndex1 < aItems.length; iRowIndex1++) {
							// var l_ean11 = oModel.getProperty("EAN11", aItems[iRowIndex1].getBindingContext());
							var l_matnr = aItems[iRowIndex1].MATNR;
							if (l_matnr === input) {
								flg = "X";
								break;
							}
						}
					}
				}

				if (flg === "X") {
					this.getView().byId("NMATNR").setValue(input);
					var aTableSearchState = [];
					var sQuery = input; //oEvent.getParameter("query");

					if (sQuery && sQuery.length > 0) {
						aTableSearchState = [new Filter("MATNR", FilterOperator.Contains, sQuery)];
						//new Filter("MATNR", FilterOperator.Contains, sQuery.toUpperCase())
					}
					this._applySearch(aTableSearchState);
				} else {
					sap.m.MessageToast.show("Item doesn't exit in list");
				}
			} else {
				sQuery = input; //oEvent.getParameter("query");

				if (sQuery && sQuery.length > 0) {
					aTableSearchState = [new Filter("MATNR", FilterOperator.Contains, sQuery)];
					//new Filter("MATNR", FilterOperator.Contains, sQuery.toUpperCase())
				}
				this._applySearch(aTableSearchState);
			}

		},

		onAddByEAN: function (oEvent) {
			var that = this;
			var oView = that.getView();
			var tour = that.getView().byId("TOUR")._lastValue;
			if (tour === "" || tour === undefined) {
				sap.m.MessageToast.show("Please select tour first");
			} else {
				var oDialog = oView.byId("Dialog");
				// create dialog lazily
				if (!oDialog) {
					// create dialog via fragment factory
					oDialog = sap.ui.xmlfragment(oView.getId(), "com.baba.ZDSD_UNLOAD_V3.view.Dialog", this);
					// connect dialog to view (models, lifecycle)
					oView.addDependent(oDialog);
				}
				oDialog.setTitle("Add/Search Material");
				oDialog.open(that);
			}
		},

		onAdd: function (oEvent) {

			var that = this;
			var tour = that.getView().byId("TOUR")._lastValue;
			var input = that.getView().byId("NMATNR").getValue();
			// var uom = that.getView().byId("oSelect2").getValue();
			var box = that.getView().byId("BOX").getSelected();
			var pc = that.getView().byId("PC").getSelected();
			if (box === true) {
				var uom = "BOX";
			} else if (pc === true) {
				uom = "PC";
			}

			if (tour === "") {
				sap.m.MessageToast.show("Please select tour first");
			} else {
				if ((input !== "" && input !== undefined) && (uom !== "" && uom !== undefined)) {
					var oTable = this.byId("table");
					var oModel = oTable.getModel();
					var aItems = oModel.oData.data; //All rows  
					var flg = "";

					if (aItems !== undefined) {
						for (var iRowIndex1 = 0; iRowIndex1 < aItems.length; iRowIndex1++) {
							// var l_ean11 = oModel.getProperty("EAN11", aItems[iRowIndex1].getBindingContext());
							var l_matnr = aItems[iRowIndex1].MATNR;
							var l_uom = aItems[iRowIndex1].UOM;
							var l_ret = aItems[iRowIndex1].VAL.substring(0, 3);
							if (l_matnr === input && l_uom === uom && l_ret !== "RET") {
								flg = "X";
								break;
							}
						}
					}
					if (flg === "X") {
						sap.m.MessageToast.show("Material & UOM already in the list");
					} else {

						// //************************filter Date*******************************************//

						var oBusy = new sap.m.BusyDialog();
						that.onBusyS(oBusy);

						//************************get values from backend based on filter Date*******************************************//

						var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
						var itemData = oModel.getProperty("/data");

						oModel1.read("/MATERIALGETSet(TOUR_ID='" + tour + "',MATNR='" + input + "',UOM='" + uom + "')", {
							success: function (oData, oResponse) {
								var res = {};
								res = oData;
								that.onRef(that);

								var itemRow = {
									MATNR: res.MATNR,
									MAKTX: res.MAKTX,
									UOM: res.UOM,
									// RET: res[iRowIndex].RET,
									QTYD: res.QTYD,
									QTYC: res.QTYC,
									TOUR_ID: res.TOUR_ID,
									ITEMNR: res.ITEMNR,
									EAN11: res.EAN11,
									// COMP: res[iRowIndex].COMP,
									VAL: res.VAL,
									QTYV: res.QTYV
								};

								if (typeof itemData !== "undefined" && itemData.length > 0) {
									itemData.push(itemRow);
								} else {
									itemData = [];
									itemData.push(itemRow);
								}

								// }

								// // Set Model
								oModel.setData({
									data: itemData
								});

								oModel.refresh(true);

								sap.m.MessageToast.show("New Items " + input + "/" + uom + " Added");

								//************************get values from backend based on filter Date*******************************************//
								that.onBusyE(oBusy);

							},
							error: function (oResponse) {
								that.onBusyE(oBusy);
								var oMsg = JSON.parse(oResponse.responseText);
								jQuery.sap.require("sap.m.MessageBox");
								MessageBox.error(oMsg.error.message.value);
								// sap.m.MessageToast.show(oMsg.error.message.value);
							}
						});
					}

				} else {
					sap.m.MessageToast.show("Please add material & UOM");
				}
			}
		},

		onAddS: function (oEvent) { //sear by Material dialog
			var that = this;
			var oView = that.getView();
			var tour = that.getView().byId("TOUR")._lastValue;
			if (tour === "" || tour === undefined) {
				sap.m.MessageToast.show("Please select tour first");
			} else {
				var oDialog = oView.byId("MDialog");
				// create dialog lazily
				if (!oDialog) {
					// create dialog via fragment factory
					oDialog = sap.ui.xmlfragment(oView.getId(), "com.baba.ZDSD_UNLOAD_V3.view.MDialog", this);
					// connect dialog to view (models, lifecycle)
					oView.addDependent(oDialog);
				}
				oDialog.setTitle("Add/Search Material");
				oDialog.open(that);
			}

		},

		onAddMD: function (oEvent) {

			var that = this;
			var tour = that.getView().byId("TOUR")._lastValue;
			// var input = that.getView().byId("NMATNR").getValue();
			// // var uom = that.getView().byId("oSelect2").getValue();
			// var box = that.getView().byId("BOX").getSelected();
			// var pc = that.getView().byId("PC").getSelected();
			// if (box === true) {
			// 	var uom = "BOX";
			// } else if (pc === true) {
			// 	uom = "PC";
			// }

			// var input = that.getView().byId("searchField").getValue();
			var input0 = that.getView().byId("searchField").getValue();
			var input1 = input0.split(" - ");
			var input = input1[0];

			if (input === "") {
				var flg_no = "NO";
				sap.m.MessageToast.show("Please provide input");
			} else {
				flg_no = "YES";
			}

			if (flg_no === "YES") {
				var val = that.getView().byId("FETV").getValue();
				var box = that.getView().byId("BOXD").getSelected();
				var pc = that.getView().byId("PCD").getSelected();
				if (box === true) {
					var uom = "BOX";
				} else if (pc === true) {
					uom = "PC";
				}

				if (tour === "") {
					sap.m.MessageToast.show("Please select tour first");
				} else {
					if ((input !== "" && input !== undefined) && (uom !== "" && uom !== undefined)) {
						var oTable = this.byId("table");
						var oModel = oTable.getModel();
						var aItems = oModel.oData.data; //All rows  
						var flg = "";

						if (aItems !== undefined) {
							for (var iRowIndex1 = 0; iRowIndex1 < aItems.length; iRowIndex1++) {
								// var l_ean11 = oModel.getProperty("EAN11", aItems[iRowIndex1].getBindingContext());
								var l_matnr = aItems[iRowIndex1].MATNR;
								var l_uom = aItems[iRowIndex1].UOM;
								var l_ret = aItems[iRowIndex1].VAL.substring(0, 3);
								if (l_matnr === input && l_uom === uom && l_ret !== "RET") {
									flg = "X";
									// aItems[iRowIndex1].QTYC = val;
									// oModel.refresh(true);
									break;
								}
							}
						}
						if (flg === "X") {
							sap.m.MessageToast.show("Material & UOM already in the list");
						} else {

							// //************************filter Date*******************************************//

							var oBusy = new sap.m.BusyDialog();
							that.onBusyS(oBusy);

							//************************get values from backend based on filter Date*******************************************//

							var oModel1 = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZDSDO_UNLOAD_V3_SRV/", true);
							var itemData = oModel.getProperty("/data");

							oModel1.read("/MATERIALGETSet(TOUR_ID='" + tour + "',MATNR='" + input + "',UOM='" + uom + "')", {
								success: function (oData, oResponse) {
									var res = {};
									res = oData;
									that.onRef(that);

									var itemRow = {
										MATNR: res.MATNR,
										MAKTX: res.MAKTX,
										UOM: res.UOM,
										// RET: res[iRowIndex].RET,
										QTYD: res.QTYD,
										QTYC: val, //res.QTYC,
										TOUR_ID: res.TOUR_ID,
										ITEMNR: res.ITEMNR,
										EAN11: res.EAN11,
										// COMP: res[iRowIndex].COMP,
										VAL: res.VAL,
										QTYV: res.QTYV
									};

									if (typeof itemData !== "undefined" && itemData.length > 0) {
										itemData.push(itemRow);
									} else {
										itemData = [];
										itemData.push(itemRow);
									}

									// }

									// // Set Model
									oModel.setData({
										data: itemData
									});

									oModel.refresh(true);

									sap.m.MessageToast.show("New Items " + input + "/" + uom + " Added");

									//************************get values from backend based on filter Date*******************************************//
									that.onBusyE(oBusy);

								},
								error: function (oResponse) {
									that.onBusyE(oBusy);
									var oMsg = JSON.parse(oResponse.responseText);
									jQuery.sap.require("sap.m.MessageBox");
									MessageBox.error(oMsg.error.message.value);
									// sap.m.MessageToast.show(oMsg.error.message.value);
								}
							});

							that.getView().byId("searchField").setValue();
							that.getView().byId("FETV").setValue();
						}

					} else {
						sap.m.MessageToast.show("Please add material & UOM");
					}
				}
			}
		},

		onAddDes: function (oEvent) { //sear by Material dialog
			var that = this;
			var oView = that.getView();
			var tour = that.getView().byId("TOUR")._lastValue;
			if (tour === "" || tour === undefined) {
				sap.m.MessageToast.show("Please select tour first");
			} else {
				var oDialog = oView.byId("MDialog");
				// create dialog lazily
				if (!oDialog) {
					// create dialog via fragment factory
					oDialog = sap.ui.xmlfragment(oView.getId(), "com.baba.ZDSD_UNLOAD_V3.view.DesDialog", this);
					// connect dialog to view (models, lifecycle)
					oView.addDependent(oDialog);
				}
				oDialog.setTitle("Search by description");
				oDialog.open(that);
			}

		},

		onAddDesd: function (oEvent) {
			var that = this;
			var input = that.getView().byId("FETDES").getValue();
			var aTableSearchState = [];
			var sQuery = input;

			if (sQuery && sQuery.length > 0) {
				aTableSearchState = [new Filter("MAKTX", FilterOperator.Contains, sQuery.toUpperCase())];
			}
			this._applySearch(aTableSearchState);
			that.byId("DesDialog").destroy();
		},

		onDesCloseDialog: function (oEvent) {
			var that = this;
			that.byId("DesDialog").destroy();
		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function () {
			var oTable = this.byId("table");
			oTable.getBinding("items").refresh();
		},

		onRef: function (oEvent, SMAT) {
			var that = this;
			// that.getView().byId("searchField").setValue("");
			if (SMAT === "X") {} else {
				that.getView().byId("NMATNR").setValue();
			}
			// that.getView().byId("oSelect2").setValue();
			var aTableSearchState = [];
			// var sQuery = "";

			// if (sQuery && sQuery.length > 0) {
			// 	aTableSearchState = [new Filter("EAN11", FilterOperator.Contains, sQuery)];
			// }
			this._applySearch(aTableSearchState);

		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Shows the selected item on the object page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showObject: function (oItem) {
			this.getRouter().navTo("object", {
				objectId: oItem.getBindingContext().getProperty("BNAME")
			});
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @param {sap.ui.model.Filter[]} aTableSearchState An array of filters for the search
		 * @private
		 */
		_applySearch: function (aTableSearchState) {
			var oTable = this.byId("table"),
				oViewModel = this.getModel("worklistView");
			oTable.getBinding("items").filter(aTableSearchState, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aTableSearchState !== undefined) {
				if (aTableSearchState.length !== 0) {
					oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
				}
			}
		}

	});
});