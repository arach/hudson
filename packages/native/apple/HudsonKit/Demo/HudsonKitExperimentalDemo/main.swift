import HudsonKitExperimental

print("unit(-0.25) = \(HudLevelNormalizer.unit(-0.25))")
print("unit(0.5) = \(HudLevelNormalizer.unit(0.5))")
print("unit(1.25) = \(HudLevelNormalizer.unit(1.25))")
print("linear(-100, -80...0) = \(HudLevelNormalizer.linear(-100, from: -80, to: 0))")
print("linear(-40, -80...0) = \(HudLevelNormalizer.linear(-40, from: -80, to: 0))")
print("linear(10, -80...0) = \(HudLevelNormalizer.linear(10, from: -80, to: 0))")
