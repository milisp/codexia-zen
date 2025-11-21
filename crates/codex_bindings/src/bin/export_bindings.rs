use codex_bindings::export_bindings;

fn main() {
    export_bindings::export_ts_types();
    println!("Exported TypeScript bindings to src/bindings");
}