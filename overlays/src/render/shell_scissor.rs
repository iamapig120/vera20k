//! Shell text clips in render-target pixels. Layouts can extend beyond the
//! target while a browser canvas is being attached or resized.

#[derive(Copy, Clone, Debug, Default, PartialEq, Eq)]
pub struct ScissorRect {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

impl ScissorRect {
    /// Intersect with the actual attachment before SetScissorRect. WebGPU
    /// validates the origin even for an empty clip; skip an empty intersection.
    pub fn clipped_to(self, width: u32, height: u32) -> Option<Self> {
        if self.x >= width || self.y >= height || self.w == 0 || self.h == 0 {
            return None;
        }
        Some(Self {
            x: self.x,
            y: self.y,
            w: self.w.min(width - self.x),
            h: self.h.min(height - self.y),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::ScissorRect;

    #[test]
    fn tiny_surface_skips_offscreen_and_empty_labels() {
        assert_eq!(
            ScissorRect {
                x: 1,
                y: 2,
                w: 0,
                h: 0
            }
            .clipped_to(1, 1),
            None
        );
        assert_eq!(
            ScissorRect {
                x: 0,
                y: 0,
                w: 0,
                h: 1
            }
            .clipped_to(1, 1),
            None
        );
    }

    #[test]
    fn partial_label_intersects_attachment_without_overflow() {
        let clip = ScissorRect {
            x: 3,
            y: 2,
            w: u32::MAX,
            h: u32::MAX,
        };
        assert_eq!(
            clip.clipped_to(5, 4),
            Some(ScissorRect {
                x: 3,
                y: 2,
                w: 2,
                h: 2
            })
        );
        let visible = ScissorRect {
            x: 1,
            y: 1,
            w: 2,
            h: 2,
        };
        assert_eq!(visible.clipped_to(5, 4), Some(visible));
    }
}
