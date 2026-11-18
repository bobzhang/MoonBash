// moon_bash Filesystem Types

///|
pub(all) enum FsEntry {
  File(FileData)
  Directory(DirData)
  Symlink(SymlinkData)
}

///|
pub(all) struct FileData {
  mut content : String
  mut mode : Int32
  mut mtime : Int64
}

///|
pub(all) struct DirData {
  mut mode : Int32
  mut mtime : Int64
}

///|
pub(all) struct SymlinkData {
  target : String
  mut mode : Int32
  mut mtime : Int64
}

///|
#derive(Debug)
pub(all) struct FsStat {
  is_file : Bool
  is_directory : Bool
  is_symlink : Bool
  size : Int32
  mode : Int32
  mtime : Int64
}

///|
#derive(Debug)
pub(all) struct DirentEntry {
  name : String
  entry_type : EntryType
}

///|
#derive(Debug)
pub(all) enum EntryType {
  FileType
  DirectoryType
  SymlinkType
}

///|
pub suberror FsError {
  FsError(String)
}
