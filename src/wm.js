/**
 ** DCWM - https://github.com/dogcontrols/dcwm 
 **/
var WM;
(function() {
    "use strict";
    if (WM) throw "WM: multiple definitions";
    WM = {};

    var windowContainer;
    var selectedWindow;
    var mousedown, mouseup, mousemove;
    var moveStart;
    var mouseStart;
    var dragObject, dragClone, dragOffset, lastDragOver, funcDragCleanup;
    var fireEvent, events = { drag: "drag", dragover: "dragover", drop: "drop" };

    WM.mx = 0;
    WM.my = 0;
    WM.limitWindowsToView = true;
    WM.deferVisibilityUpdates = false;
    var deferredVisibilityUpdateQueue = [];
    WM.maxMenuLevels = 3;
    WM.zStartWindow = 100;
    WM.zStartMenu = 200;
    WM.zStartClone = 297;
    WM.zStartTooltip = 300;
    WM.zStartMax = 400;

    WM.listen = function(f) {
        fireEvent = f;
    };

    WM.listen(function(msg, next) {
        return next(msg);
    });

    var getJObj = function(a) {
        return a instanceof jQuery ? a : $(typeof a === "string" ? "#" + a : a);
    };

    WM.isWindow = function(e) {
        return getJObj(e).hasClass("window");
    };

    WM.isMenu = function(e) {
        return getJObj(e).hasClass("menu");
    };

    WM.isTooltip = function(e) {
        return getJObj(e).hasClass("tooltip");
    };

    WM.isAnyWindowType = function(e) {
        return getJObj(e).is(".window,.menu,.tooltip");
    };

    WM.isInput = function(e) {
        return getJObj(e).is("input,button,select,textarea");
    };

    var getTopmostOfType = function(windowType) {
        var w = $("." + windowType).filter(":visible").closest("." + windowType);
        if (w[0]) {
            var highestZ = 0, highestW;
            w.each(function() {
                var e = $(this);
                var z = parseInt(e.css("z-index"));
                if (z >= highestZ) {
                    highestZ = z;
                    highestW = e;
                }
            });

            return highestW;
        }

        return $(undefined);
    };

    WM.getTopmost = function() {
        var search = ["tooltip", "menu", "window"];
        for (var i = 0; i < search.length; i++) {
            var w = getTopmostOfType(search[i]);
            if (w[0]) {
                return w;
            }
        }
        return $(undefined);
    };

    WM.closeTopmostWindow = function() {
        WM.hideWindow(WM.getTopmost());
    };

    WM.closeMenus = function() {
        WM.hideWindow($(".menu").filter(":visible"));
    };

    WM.closeSubMenus = function(w) {
        w = getJObj(w);
        if (WM.isMenu(w)) {
            // close all windows having higher level-#s, up to WM.maxMenuLevels.
            var a = $.grep(w[0].className.split(" "), function(cls) { return cls.lastIndexOf("level-", 0) === 0; });
            var n, currentLevel = 0;
            if (a && a.length > 0 && (n = parseInt(a[0].substr("level-".length))) && !isNaN(n)) {
                currentLevel = n;
            }
            for (var i = n + 1; i <= WM.maxMenuLevels; i++) {
                WM.hideWindow($(".level-" + i).filter(":visible"));
            }
        }
    };

    // returns the fixed z position for a window, or undefined if not fixed
    WM.getFixedZ = function(w) {
        w = getJObj(w);
        var z;
        if (WM.isWindow(w)) {
            if (w.hasClass("always-on-bottom")) {
                z = WM.zStartWindow - 1;
            } else if (w.hasClass("always-on-top")) {
                z = WM.zStartMenu - 2;
            }
        } else if (WM.isMenu(w)) {
            if (w.hasClass("always-on-bottom")) {
                z = WM.zStartMenu - 1;
            } else if (w.hasClass("always-on-top")) {
                z = WM.zStartTooltip - 2;
            }
        } else if (WM.isTooltip(w)) {
            if (w.hasClass("always-on-bottom")) {
                z = WM.zStartTooltip - 1;
            } else if (w.hasClass("always-on-top")) {
                z = WM.zStartMax - 2;
            }
        }
        return z;
    };

    WM.resetZIndexes = function(container) {
        container = getJObj(container);
        var zwin = WM.zStartWindow, zmenu = WM.zStartMenu, ztip = WM.zStartTooltip;
        container.children(".window,.menu,.tooltip").each(function() {
            var e = $(this);
            var newZ, fixedZ = WM.getFixedZ(e);
            if (fixedZ !== undefined) {
                newZ = fixedZ;
            } else if (WM.isTooltip(e)) {
                newZ = ztip++;
            } else if (WM.isMenu(e)) {
                newZ = zmenu++;
            } else if (WM.isWindow(e)) {
                newZ = zwin++;
            }
            newZ && e.css({ "z-index": newZ });
        });
    };

    var makeTopmostZ = function(elemToMakeTopmost, elemGroup, min, max) {
        var pivot = parseInt(elemToMakeTopmost.css("z-index"));
        if (pivot != max) {
            elemGroup.each(function() {
                var e = $(this);
                if (e.is(elemToMakeTopmost)) { return; }
                var z = Math.max(min, Math.min(e.css("z-index"), max));
                e.css({ "z-index": z > pivot ? z - 1 : z });
            });
            elemToMakeTopmost.css({ "z-index": max });
        }
    };

    WM.bringToFront = function(w) {
        w = getJObj(w);
        var max, container = w.closest(windowContainer);
        if (container[0]) {
            var fixedZ = WM.getFixedZ(w);
            if (fixedZ) {
                w.css({"z-index": fixedZ});
            } else if (WM.isWindow(w)) {
                var windows = container.children(".window:not(.always-on-bottom,.always-on-top)");
                max = WM.zStartWindow + windows.length - 1;
                makeTopmostZ(w, windows, WM.zStartWindow, max);
            } else if (WM.isMenu(w)) {
                var menus = container.children(".menu:not(.always-on-bottom,.always-on-top)");
                max = WM.zStartMenu + menus.length - 1;
                makeTopmostZ(w, menus, WM.zStartMenu, max);
            } else if (WM.isTooltip(w)) {
                var tooltips = container.children(".tooltip:not(.always-on-bottom,.always-on-top)");
                max = WM.zStartTooltip + tooltips.length - 1;
                makeTopmostZ(w, tooltips, WM.zStartTooltip, max);
            }
        }
    };

    var deferExec = function(f) {
        WM.deferVisibilityUpdates ? deferredVisibilityUpdateQueue.push(f) : f();
    };

    WM.showWindow = function(w, keepZ) {
        w = getJObj(w);
        w[0] && deferExec(function() {
            w.show();
            WM.limitWindowToBounds(w);
            !keepZ && WM.bringToFront(w);
        });
    };

    WM.hideWindow = function(w) {
        w = getJObj(w);
        w[0] && deferExec(function() {
            w.hide();
        });
    };

    WM.toggleWindow = function(w) {
        w = getJObj(w);
        var visible = w.filter(":visible");
        var hidden = w.filter(":hidden");
        WM.hideWindow(visible);
        WM.showWindow(hidden);
    };

    WM.beginMouseDown = function(e) {
        WM.deferVisibilityUpdates = false;
        if (deferredVisibilityUpdateQueue.length !== 0) {
            var q = deferredVisibilityUpdateQueue;
            deferredVisibilityUpdateQueue = [];
            for (var i = 0; i < q.length; i++) {
                q[i]();
            }
        }
    };

    WM.findDropTarget = function(x, y) {
        var topElem = $(document.elementFromPoint(x, y));
        var e = topElem;
        for (; e[0] && !e.hasClass("drop-target") ; e = e.parent()) {
            if (WM.isAnyWindowType(e)) {
                return topElem;
            }
        }
        return e[0] ? e : topElem;
    };

    WM.calcBoundedWindowPos = function(w, left, top) {
        if (!WM.limitWindowsToView) {
            return { left: left, top: top };
        }

        w = getJObj(w);
        var x = Math.max(0, Math.min(left, window.innerWidth - w.width()));
        var y = Math.max(0, Math.min(top, window.innerHeight - w.height()));
        return { left: x, top: y };
    };

    WM.moveWindow = function(w, x, y) {
        w = getJObj(w);
        w.css({ left: x, top: y });
    };

    WM.limitWindowToBounds = function(w) {
        w = getJObj(w);
        var o = w.offset();
        var p = WM.calcBoundedWindowPos(w, o.left, o.top);
        WM.moveWindow(w, p.left, p.top);
    };

    WM.limitAllWindowsToBounds = function() {
        $(".window,.menu,.tooltip").filter(":visible").each(function() { WM.limitWindowToBounds($(this)); });
    };

    WM.moveWindowBounded = function(w, x, y) {
        w = getJObj(w);
        var p = WM.calcBoundedWindowPos(w, x, y);
        WM.moveWindow(w, p.left, p.top);
    };

    WM.setCapture = function() {
        selectedWindow[0].setCapture && selectedWindow[0].setCapture();
    };

    WM.releaseCapture = function() {
        selectedWindow[0].releaseCapture && selectedWindow[0].releaseCapture();
    };

    WM.getLayout = function() {
        var layout = [];
        $(".window").each(function() {
            var e = $(this);
            layout.push({
                id: e[0].id,
                top: parseInt(e[0].style.top),
                left: parseInt(e[0].style.left),
                visible: e.is(":visible"),
                zIndex: e.css("z-index")
            });
        });
        return layout;
    };

    WM.restoreLayout = function(layout, updateVisibility) {
        layout.forEach(function(o) {
            var w = $("#" + o.id);
            w.css({ top: o.top, left: o.left });
            if (updateVisibility) {
                o.visible ? WM.showWindow(w, true) : WM.hideWindow(w);
                w.css({ "z-index": o.zIndex });
            }
        });
    };

    //
    // moveWindow
    //
    var moveWindow_mousedown = function(e) {
        WM.setCapture();
        moveStart = selectedWindow.offset();
    };

    var moveWindow_mouseup = function(e) {
        WM.releaseCapture();
        selectedWindow = undefined;
    };

    var moveWindow_mousemove = function(e) {
        if (selectedWindow) {
            var x = moveStart.left + (WM.mx - mouseStart.left);
            var y = moveStart.top + (WM.my - mouseStart.top);
            WM.moveWindowBounded(selectedWindow, x, y);
        }
    };

    //
    // dragon drop
    //
    var drag_mousedown = function(e) {
        WM.setCapture();
        lastDragOver = undefined;
        dragClone && dragClone.remove();
        dragClone = dragObject.clone();
        dragOffset = { left: dragObject.offset().left - WM.mx, top: dragObject.offset().top - WM.my };
        dragClone.addClass("drag-clone");
        dragClone.css({ "z-index": WM.zStartClone, "pointer-events": "none", position: "absolute" });
        fireEvent(
            {
                type: events.drag,
                dragId: dragObject[0].id,
                dragObject: dragObject,
                dragClone: dragClone,
                offset: dragOffset,
                funcCleanup: null
            },
            function(e) {
                funcDragCleanup = e.funcCleanup;
                var o = { left: WM.mx + e.offset.left, top: WM.my + e.offset.top };
                dragClone.css({ left: o.left, top: o.top });
                dragClone.appendTo("body");
            });
    };

    var drag_mouseup = function(e) {
        WM.releaseCapture();
        dragCleanup();
        var d = WM.findDropTarget(e.clientX, e.clientY);
        fireEvent(
            {
                type: events.drop,
                dragId: dragObject[0].id,
                dragObject: dragObject,
                dropId: d[0] && d[0].id,
                dropTarget: d
            },
            function(e) {
                WM.bringToFront(e.dropTarget.closest(".window,.tooltip"));
            });
    };

    var drag_mousemove = function(e) {
        var d = WM.findDropTarget(e.clientX, e.clientY);
        if (d[0]) {
            fireEvent(
                {
                    type: events.dragover,
                    dragId: dragObject[0].id,
                    dragObject: dragObject,
                    dragClone: dragClone,
                    offset: dragOffset,
                    overId: d[0].id,
                    over: d,
                    enter: !lastDragOver || !lastDragOver.is(d),
                    leave: lastDragOver && !lastDragOver.is(d) && lastDragOver
                },
                function(e) {
                    e.dragClone && e.dragClone.css({ left: WM.mx + e.offset.left, top: WM.my + e.offset.top });
                });
            lastDragOver = d;
        }
    };

    var dragCleanup = function() {
        lastDragOver = undefined;
        funcDragCleanup && funcDragCleanup();
        if (dragClone) {
            dragClone.remove();
            dragClone = undefined;
        }
    };

    WM.isDragging = function() {
        return dragClone !== undefined;
    };

    //
    // install events
    //
    WM.registerContainer = function(elem) {

        windowContainer = getJObj(elem);

        WM.resetZIndexes(windowContainer);

        var updateMousePos = function(e) {
            WM.mx = e.clientX + window.pageXOffset;
            WM.my = e.clientY + window.pageYOffset;
        };

        window.addEventListener("mousedown", function(e) {
            updateMousePos(e);
            mousedown = mouseup = mousemove = undefined;
            dragCleanup();
            WM.deferVisibilityUpdates = true;

            mouseStart = { left: WM.mx, top: WM.my };

            var w, clickedElement = $(document.elementFromPoint(e.clientX, e.clientY));

            if (!WM.isInput(clickedElement)) {
                $(document.activeElement).blur();
            }

            if (!(w = clickedElement.closest(".window,.menu,.tooltip"))[0]) {
                WM.closeMenus();
            } else {
                selectedWindow = w;
                WM.bringToFront(w);

                if (w.hasClass("menu")) {
                    WM.closeSubMenus(w);
                } else {
                    WM.closeMenus();
                }
            }
        }, true);

        $(window).on("mousedown", function(e) {
            WM.beginMouseDown(e);
            return false;
        });

        window.addEventListener("mousemove", function(e) {
            updateMousePos(e);
        }, true);

        $(window).on("mousemove", function(e) {
            mousemove && mousemove(e);
        });

        $(window).on("mouseup", function(e) {
            mouseup && mouseup(e);
            mousedown = mouseup = mousemove = undefined;
        });

        $(window).on("resize", function(e) {
            WM.limitAllWindowsToBounds();
        });

        windowContainer.on("click", ".close-window", function(e) {
            WM.hideWindow($(this).closest(".window,.menu,.tooltip"));
            return false;
        });

        windowContainer.on("click", ".move-window,.drag-object,.client-area,.window,.menu,.tooltip", function(e) {
            return false;
        });

        windowContainer.on("mousedown", ".close-window,.client-area,.window,.menu,.tooltip", function(e) {
            WM.beginMouseDown(e);
            return false;
        });

        windowContainer.on("mousedown", ".move-window", function(e) {
            WM.beginMouseDown(e);
            mouseup = moveWindow_mouseup;
            mousemove = moveWindow_mousemove;
            moveWindow_mousedown();
            return false;
        });
        
        windowContainer.on("mousedown", ".drag-object", function(e) {
            WM.beginMouseDown(e);
            dragObject = $(this);
            mouseup = drag_mouseup;
            mousemove = drag_mousemove;
            drag_mousedown();
            return false;
        });

        windowContainer.on("mousedown", "input,button,select,textarea", function(e) {
            e.stopPropagation();
        });

        windowContainer.on("contextmenu", function(e) {
            if (!WM.isInput($(document.elementFromPoint(e.clientX, e.clientY)))) {
                return false;
            }
            e.stopPropagation();
        });
    };
})();
