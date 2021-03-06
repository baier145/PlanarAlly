from typing import Any, Dict

import auth
from api.socket.constants import GAME_NS
from app import app, sio
from models import Floor, Room, PlayerRoom
from models.role import Role
from state.game import game_state
from utils import logger


@sio.on("Floor.Create", namespace=GAME_NS)
@auth.login_required(app, sio)
async def create_floor(sid: str, data: Dict[str, Any]):
    pr: PlayerRoom = game_state.get(sid)

    if pr.role != Role.DM:
        logger.warning(f"{pr.player.name} attempted to create a new floor")
        return

    floor: Floor = pr.active_location.create_floor(data)

    for psid, player in game_state.get_users(active_location=pr.active_location):
        await sio.emit(
            "Floor.Create",
            {
                "floor": floor.as_dict(player, player == pr.room.creator),
                "creator": pr.player.name,
            },
            room=psid,
            namespace=GAME_NS,
        )


@sio.on("Floor.Remove", namespace=GAME_NS)
@auth.login_required(app, sio)
async def remove_floor(sid, data):
    pr: PlayerRoom = game_state.get(sid)

    if pr.role != Role.DM:
        logger.warning(f"{pr.player.name} attempted to remove a floor")
        return

    floor: Floor = Floor.get(location=pr.active_location, name=data)
    floor.delete_instance(recursive=True)

    await sio.emit(
        "Floor.Remove",
        data,
        room=pr.active_location.get_path(),
        skip_sid=sid,
        namespace=GAME_NS,
    )


@sio.on("Floor.Visible.Set", namespace=GAME_NS)
@auth.login_required(app, sio)
async def set_floor_visibility(sid, data):
    pr: PlayerRoom = game_state.get(sid)

    if pr.role != Role.DM:
        logger.warning(f"{pr.player.name} attempted to toggle floor visibility")
        return

    floor: Floor = Floor.get(location=pr.active_location, name=data["name"])
    floor.player_visible = data["visible"]
    floor.save()

    for psid in game_state.get_sids(room=pr.room, skip_sid=sid):
        await sio.emit(
            "Floor.Visible.Set", data, room=psid, namespace=GAME_NS,
        )
