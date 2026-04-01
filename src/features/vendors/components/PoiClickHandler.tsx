import { useEffect } from "react"
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import type { PoiCard } from "../constants"

export function PoiClickHandler({ onPoiClick }: { onPoiClick: (c: PoiCard) => void }) {
  const map = useMap()
  const placesLib = useMapsLibrary("places")
  useEffect(() => {
    if (!map || !placesLib) return
    const svc = new placesLib.PlacesService(map)
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent & { placeId?: string }) => {
      if (!e.placeId || !e.latLng) return
      e.stop()
      svc.getDetails(
        { placeId: e.placeId, fields: ["name","formatted_address","formatted_phone_number","website","geometry","address_components"] },
        (place, status) => {
          if (status !== placesLib.PlacesServiceStatus.OK || !place) return
          let city = "", state = ""
          for (const c of place.address_components ?? []) {
            if (c.types.includes("locality")) city = c.long_name
            if (c.types.includes("administrative_area_level_1")) state = c.short_name
          }
          onPoiClick({
            name: place.name ?? "", address: place.formatted_address ?? "",
            phone: place.formatted_phone_number ?? "", website: place.website ?? "",
            lat: place.geometry?.location?.lat() ?? e.latLng!.lat(),
            lng: place.geometry?.location?.lng() ?? e.latLng!.lng(),
            city, state,
          })
        }
      )
    })
    return () => { google.maps.event.removeListener(listener) }
  }, [map, placesLib, onPoiClick])
  return null
}
