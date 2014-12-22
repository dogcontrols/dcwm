
# DCWM - JS window manager

DCWM provides a set of window manager behaviors which you can use to turn your own HTML into an overlapping window system. The behaviors are applied via CSS classes and the behavior can be further refined by using the provided JavaScript API or regular DOM or CSS manipulators.

DCWM is not a UI framework. Instead, it implements the aspects of a window manager mainly related to handling movable and overlapping windows. For example, when you think of a menu, you probably think of a vertical list of items with mouseover highlighting which then closes when you click an item. What DCWM does is take care of the boilerplate describing how the menu interacts with the windows around it. DCWM will make sure that your menus are on top of other windows, and will close the menus when you click outside of them. What is displayed in the menu and what happens when you click inside it is entirely up to you to control.

DCWM requires jQuery 2.x, and was tested in the latest Chrome, IE and FF on Windows.

## Hello world example

See *examples/helloworld.html* for the full listing.

    <div id="window-container">
        <div id="mainWindow" class="window">
            <div class="close-window">hide</div>
            <div class="move-window">hello, world!</div>
            <div class="client-area">
                this is an example window
            </div>
        </div>
    </div>
    
## Technical notes

All windows, tooltips and menus are expected to be direct children of the `id="window-container"` element.

When a class is handled by WM, it will cancel event bubbling at that point.

For runtime visibility updates, use the APIs `WM.showWindow(w)` and `WM.hideWindow(w)` rather than setting the `display` CSS directly. 

Menus and tooltips are never shown automatically. You must write the code to handle when and where they are shown. Menus will be dismissed automatically when another window is clicked.


# API documentation (v0.0.1)

## Supported class names

##### **window**
Makes an element a window. Windows are ordered behind menus, tooltips and the drag-clone.

##### **menu**
Makes an element a menu. Menus are closed automatically when clicked outside. When a menu is clicked on, all menus of a higher level are closed automatically (see level-# below for details). Menus otherwise have no special handling when clicked. Menus are ordered above windows, and below tooltips.

##### **tooltip**
Makes an element a tooltip. Tooltips are ordered above all other window types, otherwise behave the same as windows.

##### **move-window**
Enables window dragging from this element. The nearest window, menu or tooltip in the DOM will be moved. Windows must have the CSS `position:absolute` or `position:relative` to be movable.

##### **close-window**
When clicked, closes the nearest ancestor window, menu or tooltip.

##### **drag-object**
Makes an object become draggable. When dragged, a clone of this element is made and follows the mouse by default. Drag notifications are handled with `WM.listen()`.

##### **drag-clone**
The drag-clone class is added automatically to the copy of the element being dragged.

##### **drop-target**
When a drag-object is dragged over another element, WM will first attempt to find elements under the mouse that have the drop-target class. If no elements are found with this class, it will notify the element directly under the mouse. Drag notifications are handled with `WM.listen()`.

##### **client-area**
This labels an area of a window as a client area which will tell WM to ignore clicks and drags.

##### **always-on-top**
Makes a window, tooltip, or menu always on top of its window type group. That is to say that an always-on-top window will always be above other windows but always below a menu, and a menu will always be below a tooltip. A single z-index value is used per window type to denote always-on-top. If multiple windows are marked always-on-top, they will be sorted by the DOM order (last one will be on top).

##### **always-on-bottom**
Same rules as always-on-top, except for making windows always on bottom.

##### **level-0, level-1, level-n, ...**
Supports multi-level menus. These classes must be used in conjunction with the `menu` class.

The main purpose of this class is to describe the submenu hierarchy so that submenus can be closed automatically when a higher level menu is clicked.

The maximum value of `n` is set by `WM.maxMenuLevels` and has a default value of `3`. This number is small because a linear search is used to find menus from each level, but can be changed to any value.

For the top level menu, `level-0` is implied and can be omitted.

Example:

	 <div class="menu">
		 menu items...
	 </div>
	 <div class="menu level-1">
		 menu items...
	 </div>
	 <div class="menu level-2">
		 menus items...
	 </div>


## DCWM JavaScript API
### Event handling in DCWM

Some events are surfaced using a callback method allowing the event to be intercepted and modified.

Custom event handling is accomplished by using `WM.listen` to register a callback handler. The callback takes two parameters, the first parameter `e` is an object describing the event and the second parameter `next` is a function containing the default action. Note that only one listener is supported currently. For example:

    WM.listen(function(e, next) {
        if (e.type === "drop") {
            // handle drop action ...
        }
        return next(e);
    });

Currently, there are three custom event types which are all related to drag and drop: `drag`, `dragover` and `drop`.

### Events

##### **drag**
Event members:
**type** - "drag".
**dragId** - the id of the object being dragged.
**dragObject** - the jQuery element being dragged.
**dragClone** - the clone of the dragObject that follows the mouse.
**offset** - the offset (with left and top members) applied to the dragClone. 
**funcCleanup** - allows you to specify a function to run when the dragging completes.

##### **dragover**
Event members:
**type** - "dragover"
**dragId** - the id of the object being dragged.
**dragObject** - the jQuery element being dragged.
**dragClone** - the clone of the dragObject that follows the mouse.
**offset** - the offset (with left and top members) applied to the dragClone. 
**overId** - the id of the `drop-target` the mouse is over, else the topmost element.
**over** - the jQuery element of the `drop-target` the mouse is over, else the topmost element.
**enter** - boolean that is true the first time the mouse moves over an element.
**leave** - when *enter* is true, the jQuery element of the previous element dragged over, else undefined.

##### **drop**
Event members:
**type** - "drop"
**dragId** - the id of the object being dragged.
**dragObject** - the jQuery element being dragged.
**dropId** - the id of the element dropped on.
**dropTarget** - the jQuery element dropped on.


### Variables

**WM.mx, WM.my** - Globally available mouse X and Y coordinates.
**WM.limitWindowsToView = true** - Can be set to false to disable modification of window positions during browser resize.
**WM.maxMenuLevels = 3** - See level-# class above for usage.
**WM.zStartWindow = 100**
**WM.zStartMenu = 200**
**WM.zStartClone = 297**
**WM.zStartTooltip = 300**
**WM.zStartMax = 400**

### Functions

Unless otherwise noted, function parameters named `e` or `w` accept jQuery objects, ids, or DOM elements. `e` means any element can be used, where `w` indicates a window-type element is expected.

**WM.registerContainer(container)** - initializes WM with the id of a container.
**WM.listen(f)** - sets the event listener. see Event Handling above.
**WM.getTopmost()** - finds the topmost window. visible tooltips will always be returned first, then menus, then windows.
**WM.closeTopmostWindow()**
**WM.closeMenus()**
**WM.isWindow(e)**
**WM.isMenu(e)**
**WM.isTooltip(e)**
**WM.isAnyWindowType(e)**
**WM.isInput(e)**
**WM.closeSubMenus(w)**
**WM.getFixedZ(w)** - returns a z-index number for windows with always-on-top or always-on-bottom classes, otherwise undefined.
**WM.resetZIndexes(container)** - initializes z-index values of all window elements in the container.
**WM.bringToFront(w)**
**WM.showWindow(w, keepZ)** - keepZ=true will not bring the window to front when it is shown.
**WM.hideWindow(w)**
**WM.toggleWindow(w)**
**WM.beginMouseDown(e)** - e is the mousedown MouseEvent. Any mousedown handler that cancels bubbling must call this method to ensure windows are shown and hidden properly.
**WM.findDropTarget(x, y)** - searches the DOM at the client coordinates for the best matching drop target element.
**WM.isDragging()**
**WM.calcBoundedWindowPos(w, left, top)**
**WM.moveWindow(w, x, y)** - sets the window's X and Y coordinates. x and y depend on `position` CSS of window.
**WM.limitWindowToBounds(w)**
**WM.limitAllWindowsToBounds()**
**WM.moveWindowBounded(w, x, y)** - sets the window's X and Y coordinates and ensures the window will appear within the browser viewport. x and y depend on `position` CSS of window.
**WM.getLayout()**
**WM.restoreLayout(layout, updateVisibility)**
