///|
test "SHA256 compatibility vectors" {
  assert_eq(
    compute_sha256(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  )
  assert_eq(
    compute_sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  )
  assert_eq(
    compute_sha256("ÿ"),
    "a8100ae6aa1940d0b663bb31cd466142ebbdbd5187131b92d93818987832eb89",
  )
}
