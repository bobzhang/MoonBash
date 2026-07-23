// Internal JSON bridge helpers for TypeScript wrapper-only execution options.

///|
fn json_bridge_string_array(raw : String) -> Array[String] {
  let values : Array[String] = []
  let parsed = @json.parse(raw[:]) catch { _ => return values }
  match parsed {
    Json::Array(items) =>
      for item in items {
        match item {
          Json::String(s) => values.push(s)
          Json::Number(n, ..) => values.push(n.to_int().to_string())
          Json::True => values.push("true")
          Json::False => values.push("false")
          Json::Null => values.push("")
          _ => values.push(item.stringify(indent=0))
        }
      }
    _ => ()
  }
  values
}
