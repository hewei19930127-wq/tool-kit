use serde::Serialize;

#[tauri::command]
pub fn json_format(input: String, indent: usize) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(&input).map_err(|error| error.to_string())?;
    let mut buf = Vec::new();
    let pad = " ".repeat(indent);
    let formatter = serde_json::ser::PrettyFormatter::with_indent(pad.as_bytes());
    let mut serializer = serde_json::Serializer::with_formatter(&mut buf, formatter);

    value
        .serialize(&mut serializer)
        .map_err(|error| error.to_string())?;
    String::from_utf8(buf).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn json_minify(input: String) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(&input).map_err(|error| error.to_string())?;
    serde_json::to_string(&value).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn xml_format(input: String, indent: usize) -> Result<String, String> {
    use quick_xml::events::Event;
    use quick_xml::{Reader, Writer};

    let mut reader = Reader::from_str(&input);
    reader.config_mut().trim_text(true);
    let mut writer = Writer::new_with_indent(Vec::new(), b' ', indent);

    loop {
        match reader.read_event() {
            Ok(Event::Eof) => break,
            Ok(event) => writer
                .write_event(event)
                .map_err(|error| error.to_string())?,
            Err(error) => {
                return Err(format!(
                    "XML error at {}: {}",
                    reader.buffer_position(),
                    error
                ))
            }
        }
    }

    String::from_utf8(writer.into_inner()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn xml_minify(input: String) -> Result<String, String> {
    use quick_xml::events::Event;
    use quick_xml::{Reader, Writer};

    let mut reader = Reader::from_str(&input);
    reader.config_mut().trim_text(true);
    let mut writer = Writer::new(Vec::new());

    loop {
        match reader.read_event() {
            Ok(Event::Eof) => break,
            Ok(event) => writer
                .write_event(event)
                .map_err(|error| error.to_string())?,
            Err(error) => {
                return Err(format!(
                    "XML error at {}: {}",
                    reader.buffer_position(),
                    error
                ))
            }
        }
    }

    String::from_utf8(writer.into_inner()).map_err(|error| error.to_string())
}
