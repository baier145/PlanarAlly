import gameManager from "./planarally";
import { alphSort } from "./utils";
import { setupTools } from "./tools/tools";
import { ClientOptions, LocationOptions, AssetList, ServerShape, InitiativeData, BoardInfo } from "./api_types";

const socket = io.connect(location.protocol + "//" + location.host + "/planarally");
socket.on("connect", function () {
    console.log("Connected");
});
socket.on("disconnect", function () {
    console.log("Disconnected");
});
socket.on("redirect", function (destination: string) {
    console.log("redirecting");
    window.location.href = destination;
});
socket.on("set room info", function (data: {name: string, creator: string}) {
    gameManager.roomName = data.name;
    gameManager.roomCreator = data.creator;
});
socket.on("set username", function (username: string) {
    gameManager.username = username;
    gameManager.IS_DM = username === window.location.pathname.split("/")[2];
    if ($("#toolselect").find("ul").html().length === 0)
        setupTools();
});
socket.on("set clientOptions", function (options: ClientOptions) {
    gameManager.setClientOptions(options);
});
socket.on("set locationOptions", function (options: LocationOptions) {
    gameManager.layerManager.setOptions(options);
});
socket.on("set location", function (data: {name:string, options: LocationOptions}) {
    gameManager.locationName = data.name;
    gameManager.layerManager.setOptions(data.options);
});
socket.on("asset list", function (assets: AssetList) {
    const m = $("#menu-tokens");
    m.empty();
    let h = '';

    const process = function (entry: AssetList, path: string) {
        const folders = new Map(Object.entries(entry.folders));
        folders.forEach(function (value, key) {
            h += "<button class='accordion'>" + key + "</button><div class='accordion-panel'><div class='accordion-subpanel'>";
            process(value, path + key + "/");
            h += "</div></div>";
        });
        entry.files.sort(alphSort);
        entry.files.forEach(function (asset) {
            h += "<div class='draggable token'><img src='/static/img/assets/" + path + asset + "' width='35'>" + asset + "<i class='fas fa-cog'></i></div>";
        });
    };
    process(assets, "");
    m.html(h);
    $(".draggable").draggable({
        helper: "clone",
        appendTo: "#board"
    });
    $('.accordion').each(function (idx) {
        $(this).on("click", function () {
            $(this).toggleClass("accordion-active");
            $(this).next().toggle();
        });
    });
});
socket.on("board init", function (location_info: BoardInfo) {
    gameManager.setupBoard(location_info)
});
socket.on("set gridsize", function (gridSize: number) {
    gameManager.layerManager.setGridSize(gridSize);
});
socket.on("add shape", function (shape: ServerShape) {
    gameManager.addShape(shape);
});
socket.on("remove shape", function (shape: ServerShape) {
    if (!gameManager.layerManager.UUIDMap.has(shape.uuid)){
        console.log(`Attempted to remove an unknown shape`);
        return ;
    }
    if (!gameManager.layerManager.hasLayer(shape.layer)) {
        console.log(`Attempted to remove shape from an unknown layer ${shape.layer}`);
        return ;
    }
    const layer = gameManager.layerManager.getLayer(shape.layer)!;
    layer.removeShape(gameManager.layerManager.UUIDMap.get(shape.uuid)!, false);
    layer.invalidate(false);
});
socket.on("moveShapeOrder", function (data: { shape: ServerShape; index: number }) {
    if (!gameManager.layerManager.UUIDMap.has(data.shape.uuid)) {
        console.log(`Attempted to move the shape order of an unknown shape`);
        return ;
    }
    if (!gameManager.layerManager.hasLayer(data.shape.layer)) {
        console.log(`Attempted to remove shape from an unknown layer ${data.shape.layer}`);
        return ;
    }
    const shape = gameManager.layerManager.UUIDMap.get(data.shape.uuid)!;
    const layer = gameManager.layerManager.getLayer(shape.layer)!;
    layer.moveShapeOrder(shape, data.index, false);
});
socket.on("shapeMove", function (shape: ServerShape) {
    gameManager.moveShape(shape);
});
socket.on("updateShape", function (data: { shape: ServerShape; redraw: boolean }) {
    gameManager.updateShape(data);
});
socket.on("updateInitiative", function (data: InitiativeData) {
    if (data.initiative === undefined || (!data.owners.includes(gameManager.username) && !gameManager.IS_DM && !data.visible))
        gameManager.initiativeTracker.removeInitiative(data.uuid, false, true);
    else
        gameManager.initiativeTracker.addInitiative(data, false);
});
socket.on("setInitiative", function (data: InitiativeData[]) {
    gameManager.setInitiative(data);
});
socket.on("clear temporaries", function (shapes: ServerShape[]) {
    shapes.forEach(function (shape) {
        if (!gameManager.layerManager.UUIDMap.has(shape.uuid)) {
            console.log("Attempted to remove an unknown temporary shape");
            return ;
        }
        if (!gameManager.layerManager.hasLayer(shape.layer)){
            console.log(`Attempted to remove shape from an unknown layer ${shape.layer}`);
            return ;
        }
        const real_shape = gameManager.layerManager.UUIDMap.get(shape.uuid)!;
        gameManager.layerManager.getLayer(shape.layer)!.removeShape(real_shape, false);
    })
});

export default socket;