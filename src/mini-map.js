"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapControls = void 0;
var react_1 = require("react");
// import { useEventsChannel } from "app/javascript/components/common/hooks";
var debounce_1 = require("lodash/debounce");
var classnames_1 = require("classnames");
var jquery_1 = require("jquery");
var Log = {
    warn: function (message) { return console.warn("[MiniMap]", message); }
};
var MapType;
(function (MapType) {
    MapType[MapType["relative"] = 0] = "relative";
    MapType[MapType["fixed"] = 1] = "fixed";
})(MapType || (MapType = {}));
var DefaultMapIcon = function () { return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
    <path d="M384 476.1L192 421.2V35.9L384 90.8V476.1zm32-1.2V88.4L543.1 37.5c15.8-6.3 32.9 5.3 32.9 22.3V394.6c0 9.8-6 18.6-15.1 22.3L416 474.8zM15.1 95.1L160 37.2V423.6L32.9 474.5C17.1 480.8 0 469.2 0 452.2V117.4c0-9.8 6-18.6 15.1-22.3z"/>
  </svg>); };
var mapSelectors = {
    wrapper: "#mini-map-wrapper",
    blocker: ".map-blocker",
    viewport: ".mini-map-viewport",
    map: "#mini-map",
};
var MapControls = function (_a) {
    var mapTarget = _a.mapTarget;
    var _b = (0, react_1.useState)(false), showMap = _b[0], setShowMap = _b[1];
    var _c = (0, react_1.useState)(MapType.relative), mapType = _c[0], setMapType = _c[1];
    return (<div className="viewport-controls" style={{ right: 138 }}>
      {showMap && <MiniMap target={mapTarget} mapType={mapType}/>}
      <div className="controls">
        <a className={(0, classnames_1.default)("control")} title={"Show minimap"} onClick={function (e) {
            e.preventDefault();
            setShowMap(!showMap);
        }}>
          <DefaultMapIcon />
        </a>
        {/* {showMap && <input type="checkbox" onChange={({ target }) => target.checked ? setMapType(mapTypes.relative) : setMapType(mapTypes.fixed)} defaultChecked={true} />} */}
      </div>
    </div>);
};
exports.MapControls = MapControls;
var MiniMap = function (_a) {
    var target = _a.target, mapType = _a.mapType;
    var invalidationToken = useMiniMapInvalidation();
    var _b = (0, react_1.useState)(false), readyToMap = _b[0], setReadyToMap = _b[1];
    var _c = (0, react_1.useState)(false), eventsSet = _c[0], setEventsSet = _c[1];
    var _d = (0, react_1.useState)(false), draggingViewport = _d[0], setDraggingViewport = _d[1];
    useTargetScrollingToPositionViewport(target, draggingViewport, setReadyToMap, readyToMap);
    // Trigger map drawing/redrawing based on multiple inputs:
    // - readyToMap = the dom being ready to actually draw the map
    // - mapType = changing between types of map to draw
    // - invalidationToken = listening for events that cause the contents of the map to change, like moving bars for example
    react_1.default.useEffect(function () {
        if (readyToMap)
            drawMap(mapType, target);
    }, [invalidationToken, readyToMap, mapType]);
    // On first load start a loop, checking to see if the expected dom content is in place before deciding we have content to create a map with
    react_1.default.useEffect(function () {
        if (!readyToMap)
            checkIfReadyToMap(target.readyIndicator, setReadyToMap);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Listen to events on the mini-map-viewport - so that we can scroll the view as well when it gets dragged
    if (readyToMap && !eventsSet) {
        setEventsSet(true);
        listenToMiniMapEvents(setDraggingViewport, target);
        positionMapFirstTime(target);
    }
    return (<div id="mini-map-wrapper">
      <div className="mini-map-viewport"/>
      <div className="map-blocker"/>
      <div id="mini-map" className="mini-map"/>
    </div>);
};
var positionMapFirstTime = function (target) {
    var event = new Event("scroll");
    (0, jquery_1.default)(target.scrollEl)[0].dispatchEvent(event);
};
// Use the content from the dom to determine when we are able to produce a usable map.
// There may be other approaches we can take with newer views (like eventing out when a view is finished loading)
// however for views like Timeline, which are a combination of components and jquery, there is no good indicator
// short of querying the dom and waiting for an element to show up. In this case we are looking for elements that match
// based on class name.
var checkIfReadyToMap = function (readyIndicator, setReadyToMap) {
    setTimeout(function () {
        var expectedElementsRendered = document.getElementsByClassName(readyIndicator).length > 0;
        if (expectedElementsRendered) {
            setReadyToMap(true);
        }
        else {
            checkIfReadyToMap(readyIndicator, setReadyToMap);
        }
    }, 50);
};
// Create and remove an event listener for the target element that updates the location of the viewport
// whenever scrolling occurs.
function useTargetScrollingToPositionViewport(target, draggingViewport, setReadyToMap, readyToMap) {
    var el = (0, jquery_1.default)(target.scrollEl);
    var handleScroll = function () {
        if (!draggingViewport) {
            var left = el.scrollLeft() || 0;
            var top_1 = el.scrollTop() || 0;
            (0, jquery_1.default)(mapSelectors.viewport).css({
                marginTop: top_1 * 0.1,
                marginLeft: left * 0.1,
            });
        }
    };
    react_1.default.useEffect(function () {
        el[0].addEventListener("scroll", handleScroll);
        if (!readyToMap)
            checkIfReadyToMap(target.readyIndicator, setReadyToMap);
        return function () {
            el[0].removeEventListener("scroll", handleScroll);
        };
        // In this case we don't want this firing constantly because it leaves the event handler off when we expect it to be on
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
var drawMap = function (mapType, target) {
    if (mapType === MapType.relative) {
        drawRelativelySizedMap(target);
    }
    else if (mapType === MapType.fixed) {
        alert("Currently commented out");
        // drawFixedSizeMap(target)
    }
};
var createMappableClone = function (target) {
    // Look for the expected content and clone it
    var content = (0, jquery_1.default)(target.elementToMap);
    // if (!content) return null;
    var clone = content.clone();
    // Remove anything from the clone that we don't want in the map.
    // In practice this could be anything that doesn't provide useful content when scaled way down.
    // Additionally anything that needs to have it's position updated when the view scales, like titles,
    // should be removed because this is a complete copy of the dom and positioning events would also run
    // in the mini-map - which can cause memory issues.
    clone.find(".lane-title-box").empty();
    clone.find(".project-bar-title").remove();
    clone.find(".container-bar-title").remove();
    // Return the clone + some useful details about it
    return {
        clone: clone,
        contentWidth: content[0].scrollWidth,
        contentHeight: content[0].scrollHeight,
    };
};
var drawRelativelySizedMap = function (target) {
    var _a = createMappableClone(target), clone = _a.clone, contentWidth = _a.contentWidth, contentHeight = _a.contentHeight;
    var getClone = function () { return clone; };
    // Determine the map and view window scales
    var mapWidth = contentWidth / 10;
    var mapHeight = contentHeight / 10;
    var modifier = 0.01;
    var mapCSSScale = (contentWidth / mapWidth) * modifier;
    var viewportWidth = (0, jquery_1.default)(target.coverWidthRef).width();
    var viewportHeight = ((0, jquery_1.default)(target.coverWidthRef).height() || 0) - ((0, jquery_1.default)(".floatThead-container").height() || 0);
    (0, jquery_1.default)(mapSelectors.wrapper).css({
        width: mapWidth,
        height: mapHeight,
        maxHeight: "",
        minHeight: "",
    });
    (0, jquery_1.default)(mapSelectors.map)
        .html(getClone())
        .css({
        transform: "scale(".concat(mapCSSScale, ")"),
    });
    (0, jquery_1.default)(mapSelectors.viewport).css({
        height: viewportHeight,
        width: viewportWidth,
    });
};
// TODO: figure out the math to make this work correctly
// So far it mostly worked, but because it uses the same helpers but slightly different math it just feels "off"
// const drawFixedSizeMap = target => {
//     const maxMapWidth = 165;
//     const maxMapHeight = 165;
//     const {clone, contentWidth, contentHeight} = createMappableClone(target);
//     const widthScale = maxMapWidth / contentWidth;
//     const viewportWidth = $(target.coverWidthRef).width();
//     const viewportHeight = $(target.coverWidthRef).height() - $('.floatThead-container').height();
//     const newWrapperHeight = contentHeight * widthScale;
//     // Determine the map size - should stay the same, it isn't changing, its contents are
//     $(mapSelectors.wrapper).css({ width: maxMapWidth, height: newWrapperHeight });
//     // Resize the minimap - it's now wider
//     $(mapSelectors.map)
//         .html(clone)
//         .css({
//             transform: `scale(${widthScale})`
//         });
//     $(mapSelectors.viewport).css({
//         transform: `scale(${widthScale})`,
//         height: viewportHeight,
//         width: viewportWidth
//     });
// }
// TODO: investigate these events a bit more.
// This pattern was pulled from what was done for the bar connection lines but it isn't a perfect 1:1.
function useMiniMapInvalidation() {
    var _a = (0, react_1.useState)(0), token = _a[0], setToken = _a[1];
    // In many cases many events are fired in quick bursts, but we only need to invalidate once.
    // There are also some cases (particularly for milestones) where some of the DOM updates
    // happen right after the event is published. Giving invalidation a short debounce solves both
    // problems.
    var invalidateDelayed = react_1.default.useCallback((0, debounce_1.default)(function () { return setToken(function (t) { return t + 1; }); }, 2), []);
    // In some cases we know there is only one event and we can expedite
    var invalidate = function () {
        invalidateDelayed();
        invalidateDelayed.flush();
    };
    react_1.default.useEffect(function () { return function () { return invalidateDelayed.cancel(); }; }, [invalidateDelayed]);
    //TODO: if we don't want dragging a bar to update the map DURING DRAG remove this event
    // useEventsChannel("ON_BAR_DRAG_STOP_ACTION", invalidateDelayed);
    // useEventsChannel("ON_MILESTONE_DRAG_STOP_ACTION", invalidateDelayed);
    // useEventsChannel("CREATED_MILESTONE", invalidateDelayed);
    // useEventsChannel("ROADMAP_STYLE_UPDATED", invalidate);
    // useEventsChannel("CHANGED_ZOOM_LEVEL", invalidate);
    // useEventsChannel("ON_BAR_RESIZE_ACTION", invalidate);
    // useEventsChannel("DELETING_BAR", invalidate);
    // useEventsChannel("DUPLICATED_BAR", invalidate);
    // useEventsChannel("UPDATED_BAR", invalidateDelayed); // Important for when bars are parked
    // useEventsChannel("REDRAW_BARS_EVENT", invalidateDelayed);
    // useEventsChannel("DELETED_LANE", invalidateDelayed);
    // useEventsChannel("UNDO_BAR_EVENT", invalidateDelayed);
    // useEventsChannel("BULK_UPDATE_BARS", invalidateDelayed);
    // useEventsChannel("UPDATED_FILTERS", invalidate);
    // useEventsChannel("UPDATED_LANES", invalidate);
    // useEventsChannel("DRAW_TIMELINE", invalidateDelayed);
    // useEventsChannel("BARS_SHIFTED", invalidateDelayed);
    return token;
}
// Listen for events on the minimap itself - allowing for things like dragging the viewport and clicking on a point in the map.
var listenToMiniMapEvents = function (setDraggingViewport, target) {
    var viewportElement = document.querySelector(mapSelectors.viewport);
    if (!viewportElement) {
        Log.warn("No viewportElement found");
        return;
    }
    var scrollRef = (0, jquery_1.default)(target.scrollEl)[0];
    var map = document.querySelector("#mini-map-wrapper");
    if (!map) {
        Log.warn("No map wrapper found");
        return;
    }
    var mouseStartingX;
    var mouseStartingY;
    var dragging = false;
    var viewportLeft = 0;
    var viewportTop = 0;
    var stopDragging = function () {
        dragging = false;
        setDraggingViewport(false);
        viewportElement.classList.remove("active");
    };
    // When clicking on a part of the mini-map, outside of the current viewport, center the view there
    map.addEventListener("mousedown", function (e) {
        // Ignore click events on the viewport - they occur when dragging
        if (e.target === viewportElement || e.target === null)
            return;
        e.preventDefault();
        setDraggingViewport(false);
        // Get click position
        var rect = e.target.getBoundingClientRect();
        var clickX = e.clientX - rect.left;
        var clickY = e.clientY - rect.top;
        // Determine offsets to center viewport there and then trigger scrolling
        var viewportRect = viewportElement.getBoundingClientRect();
        viewportLeft = clickX - viewportRect.width / 2;
        viewportTop = clickY - viewportRect.height / 2;
        (0, jquery_1.default)(target.scrollEl).scrollLeft(viewportLeft * 10);
        (0, jquery_1.default)(target.scrollEl).scrollTop(viewportTop * 10);
    });
    // On mousedown of the viewport track that we are dragging and were we started from
    viewportElement.addEventListener("mousedown", function (e) {
        dragging = true;
        setDraggingViewport(true);
        viewportElement.classList.add("active");
        mouseStartingX = e.pageX - viewportLeft;
        mouseStartingY = e.pageY - viewportTop;
    });
    // In some cases we want to stop dragging/tracking altogether, like when:
    // - the user intentionally stops dragging
    // - the user drags outside of the map, which isn't a thing
    viewportElement.addEventListener("mouseup", stopDragging);
    map.addEventListener("mouseleave", stopDragging);
    // If the mouse moves while dragging update the position of elements.
    viewportElement.addEventListener("mousemove", function (e) {
        var _a;
        if (!dragging)
            return;
        e.preventDefault();
        // Left move
        var leftMoveDiff = e.pageX - viewportLeft - mouseStartingX;
        var newViewportLeftMargin = viewportLeft + leftMoveDiff;
        // Protect against dragging off of the map
        var wouldBeOutsideRight = scrollRef.scrollLeft + scrollRef.clientWidth + leftMoveDiff >
            (((_a = viewportElement.parentElement) === null || _a === void 0 ? void 0 : _a.clientWidth) || 1) * 10;
        var wouldBeOutsideLeft = newViewportLeftMargin < 0;
        if (!wouldBeOutsideRight && !wouldBeOutsideLeft)
            viewportLeft = newViewportLeftMargin;
        // Top move
        var topMoveDiff = e.pageY - viewportTop - mouseStartingY;
        viewportTop = viewportTop + topMoveDiff;
        (0, jquery_1.default)(target.scrollEl).scrollLeft(viewportLeft * 10);
        (0, jquery_1.default)(target.scrollEl).scrollTop(viewportTop * 10);
    });
};
